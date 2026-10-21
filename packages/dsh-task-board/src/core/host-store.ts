/**
 * Host-backed task store: the board's authoritative persistence.
 *
 * The Host owns the ledger file; this store is the browser-side facade that
 * keeps a local snapshot for synchronous reads, writes the whole ledger as a
 * transaction on every mutation, and adopts Host snapshots pushed over the SSE
 * revision stream. The controller therefore keeps its synchronous shape (and
 * its unit tests) while the data itself is durable on the Host.
 *
 * Migration: the previous backend stored the board in `localStorage` under
 * `dsh.taskBoard.v1`. On the first load against a never-written Host ledger,
 * that document is imported once and then moved to a read-only backup key, so
 * a second load can never import it again. When the Host already holds data,
 * the Host always wins and the legacy document is only backed up.
 *
 * Failure policy: a Host that is unreachable degrades to the last known
 * snapshot (the board stays usable in memory) and the write is retried; it
 * never throws into the UI.
 * @module @captain1275/dsh-client-ui-task-board/core/host-store
 */

import type { TaskLedger } from './ledger.ts'
import { isLedgerEmpty } from './ledger.ts'
import type { LedgerTransport } from './http-ledger.ts'
import { BACKUP_STORAGE_KEY, DEFAULT_STORAGE_KEY, parseLedger, type TaskStore } from './store.ts'
import type { TaskRecord } from './tasks.ts'

/** Storage face the migration needs (localStorage satisfies it). */
export interface LegacyStorageFace {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Store construction options. */
export interface HostTaskStoreOptions {
  /** Host ledger transport. */
  transport: LedgerTransport
  /** Legacy document storage (migration source); defaults to the global localStorage. */
  storage?: LegacyStorageFace | undefined
  /** Legacy document key; defaults to {@link DEFAULT_STORAGE_KEY}. */
  legacyKey?: string
  /** Read-only backup key; defaults to {@link BACKUP_STORAGE_KEY}. */
  backupKey?: string
  /** Retry delay after a transport failure (ms); defaults to 2000. */
  retryDelayMs?: number
  /** Timer factory (tests inject a manual/no-op one). */
  setTimer?: (fn: () => void, ms: number) => unknown
  /** Timer canceller matching {@link setTimer}. */
  clearTimer?: (handle: unknown) => void
}

/** Default retry delay after a Host transport failure. */
const DEFAULT_RETRY_MS = 2000

/** Resolve the global localStorage without assuming a browser (Host-side tests). */
function defaultStorage(): LegacyStorageFace | undefined {
  const storage = (globalThis as { localStorage?: LegacyStorageFace }).localStorage
  return storage
}

/**
 * Browser store backed by the Host ledger.
 *
 * Mutations stay synchronous (`save` updates the in-memory snapshot and the
 * board re-renders immediately); the whole-ledger write and the snapshot
 * re-read happen in the background, coalesced so a burst of edits becomes one
 * transaction plus at most one follow-up.
 */
export class HostTaskStore implements TaskStore {
  private tasks: TaskRecord[] = []
  private revision = 0
  private hydrated = false
  /** A local mutation is not yet confirmed by a Host commit. */
  private dirty = false
  private inFlight = false
  private pending = false
  private refreshQueued = false
  private retryTimer: unknown
  private retryScheduled = false
  private readyPromise: Promise<void> | undefined
  private disposeRemote: (() => void) | undefined
  private disposed = false
  private readonly listeners = new Set<() => void>()
  private readonly transport: LedgerTransport
  private readonly storage: LegacyStorageFace | undefined
  private readonly legacyKey: string
  private readonly backupKey: string
  private readonly retryDelayMs: number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  /** @param options - transport plus migration/retry knobs. */
  constructor(options: HostTaskStoreOptions) {
    this.transport = options.transport
    this.storage = options.storage ?? defaultStorage()
    this.legacyKey = options.legacyKey ?? DEFAULT_STORAGE_KEY
    this.backupKey = options.backupKey ?? BACKUP_STORAGE_KEY
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_MS
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? (handle => { clearTimeout(handle as ReturnType<typeof setTimeout>) })
  }

  /** {@inheritDoc TaskStore.load} */
  load(): TaskRecord[] {
    return this.tasks
  }

  /** {@inheritDoc TaskStore.save} */
  save(tasks: readonly TaskRecord[]): void {
    this.tasks = [...tasks]
    this.dirty = true
    void this.flush()
  }

  /** {@inheritDoc TaskStore.clear} */
  clear(): void {
    this.tasks = []
    this.dirty = true
    void this.flush()
  }

  /** {@inheritDoc TaskStore.ready} */
  ready(): Promise<void> {
    this.readyPromise ??= this.hydrate()
    return this.readyPromise
  }

  /** {@inheritDoc TaskStore.subscribe} */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** {@inheritDoc TaskStore.dispose} */
  dispose(): void {
    this.disposed = true
    if (this.retryScheduled) {
      this.clearTimer(this.retryTimer)
      this.retryScheduled = false
      this.retryTimer = undefined
    }
    this.disposeRemote?.()
    this.disposeRemote = undefined
    this.listeners.clear()
  }

  // --- hydration + migration --------------------------------------------------

  /** First snapshot load, first migration attempt, and the change subscription. */
  private async hydrate(): Promise<void> {
    const ledger = await this.transport.read()
    if (ledger === undefined) {
      // Host unreachable: stay on the in-memory snapshot and retry later.
      this.scheduleRetry()
      return
    }
    await this.adoptOrMigrate(ledger)
    this.startRemoteSync()
    if (this.dirty) void this.flush()
  }

  /**
   * Adopt the Host snapshot, importing the legacy localStorage document when
   * the Host has never been written to.
   * @param ledger - the snapshot just read from the Host.
   */
  private async adoptOrMigrate(ledger: TaskLedger): Promise<void> {
    const legacy = this.readLegacy()
    if (isLedgerEmpty(ledger) && legacy.rows.length > 0) {
      // Base revision 0 keeps two windows from importing twice: the loser of
      // the race gets a conflict with the winner's snapshot and adopts it.
      const outcome = await this.transport.write(legacy.rows, 0)
      if (outcome.ok) {
        this.applyLedger(outcome.ledger, true)
        this.retireLegacy()
        console.info(`[dsh-task-board] migrated ${legacy.rows.length} task(s) from localStorage to the Host ledger`)
        return
      }
      if (outcome.conflict && outcome.ledger !== undefined) {
        this.applyLedger(outcome.ledger, true)
        this.retireLegacy()
        return
      }
      // Host unreachable or rejected the import: keep the legacy document and
      // retry, so the user's old board is never dropped on the floor.
      this.scheduleRetry()
      return
    }
    this.applyLedger(ledger, true)
    // The Host is authoritative from here on; the legacy document is only a
    // read-only backup and the original key must never be read again.
    if (legacy.present) this.retireLegacy()
  }

  /** Start the Host change subscription (idempotent). */
  private startRemoteSync(): void {
    if (this.disposeRemote !== undefined) return
    this.disposeRemote = this.transport.subscribe(() => { void this.refresh() })
  }

  /** Adopt a snapshot, optionally merging local tasks the Host does not know yet. */
  private applyLedger(ledger: TaskLedger, mergeLocal: boolean): void {
    this.revision = ledger.revision
    this.hydrated = true
    if (mergeLocal && this.dirty) {
      const known = new Set(ledger.tasks.map(task => task.id))
      this.tasks = [...ledger.tasks, ...this.tasks.filter(task => !known.has(task.id))]
    } else {
      this.tasks = ledger.tasks
    }
    this.notify()
  }

  // --- writes -----------------------------------------------------------------

  /**
   * Whole-ledger write, coalesced: one request in flight at a time, with a
   * single follow-up covering any edits made meanwhile. A stale-revision
   * conflict adopts the Host's revision and replays the write once — last
   * write wins, the same semantics the previous shared-localStorage backend
   * had.
   */
  private async flush(): Promise<void> {
    if (this.disposed || !this.hydrated) return
    if (this.inFlight) {
      this.pending = true
      return
    }
    this.inFlight = true
    try {
      const attempt = this.tasks
      let outcome = await this.transport.write(attempt, this.revision)
      if (!outcome.ok && outcome.conflict) {
        if (outcome.ledger !== undefined) this.revision = outcome.ledger.revision
        outcome = await this.transport.write(attempt, this.revision)
      }
      if (outcome.ok) {
        this.revision = outcome.ledger.revision
        this.dirty = false
      } else {
        this.scheduleRetry()
      }
    } finally {
      this.inFlight = false
      if (this.pending) {
        this.pending = false
        void this.flush()
      } else if (this.refreshQueued) {
        this.refreshQueued = false
        void this.refresh()
      }
    }
  }

  /** Re-read the Host snapshot on a change hint (another window wrote). */
  private async refresh(): Promise<void> {
    if (this.disposed || !this.hydrated) return
    if (this.inFlight || this.pending) {
      // A local transaction owns the wire right now; re-check once it settles
      // so a foreign revision is never missed.
      this.refreshQueued = true
      return
    }
    const ledger = await this.transport.read()
    if (ledger === undefined) return
    if (ledger.revision === this.revision) return
    this.applyLedger(ledger, false)
  }

  /** Retry a failed hydrate/flush after {@link retryDelayMs}. */
  private scheduleRetry(): void {
    if (this.disposed || this.retryScheduled) return
    this.retryScheduled = true
    this.retryTimer = this.setTimer(() => {
      this.retryScheduled = false
      this.retryTimer = undefined
      if (!this.hydrated) void this.hydrate()
      else void this.flush()
    }, this.retryDelayMs)
  }

  // --- legacy localStorage ----------------------------------------------------

  /** Read the legacy document (the migration source). */
  private readLegacy(): { present: boolean; rows: TaskRecord[] } {
    if (this.storage === undefined) return { present: false, rows: [] }
    try {
      const raw = this.storage.getItem(this.legacyKey)
      if (raw === null) return { present: false, rows: [] }
      return { present: true, rows: parseLedger(raw) }
    } catch (error) {
      console.warn('[dsh-task-board] legacy ledger read failed; skipping migration', error)
      return { present: false, rows: [] }
    }
  }

  /**
   * Stop using the legacy document: copy it under the backup key, then remove
   * the original. Both steps are best-effort; a failure only delays the cleanup
   * (a later load retries it and still cannot double-import, because a
   * non-empty Host ledger takes precedence over the legacy document).
   */
  private retireLegacy(): void {
    if (this.storage === undefined) return
    try {
      const raw = this.storage.getItem(this.legacyKey)
      if (raw === null) return
      this.storage.setItem(this.backupKey, raw)
      this.storage.removeItem(this.legacyKey)
    } catch (error) {
      console.warn('[dsh-task-board] legacy ledger cleanup failed', error)
    }
  }

  /** Notify subscribers (the controller re-renders from {@link load}). */
  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
