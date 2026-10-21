/**
 * Task persistence: a small storage seam with a legacy localStorage backend.
 *
 * The board's authoritative ledger now lives on the Host (`$DSH_HOME/
 * task-board/ledger.json`, see `../host/ledger-file.ts`), reached through the
 * {@link HostTaskStore} in `./host-store.ts`, which implements the same seam.
 * This module keeps the seam itself, the localStorage backend used only for
 * the one-shot migration of pre-Host data, and the in-memory backend the unit
 * tests use.
 *
 * The seam stays deliberately small and synchronous so the controller's
 * mutations stay synchronous; a backend with an async authority (the Host
 * ledger) additionally implements the optional `ready`/`subscribe` hooks,
 * which the controller uses to adopt a snapshot fetched after boot.
 */
import { isTaskRecord, parseRowList } from './ledger.ts'
import type { TaskRecord } from './tasks.ts'

export { isTaskRecord }

/** Persistence seam for the task ledger. */
export interface TaskStore {
  /** Read the current ledger rows (the last known snapshot). */
  load(): TaskRecord[]
  /** Persist the whole ledger (replaces the stored document). */
  save(tasks: readonly TaskRecord[]): void
  /** Drop the persisted ledger (leaves the in-memory state alone). */
  clear(): void
  /**
   * Optional: settle once the backend's authoritative snapshot has been
   * loaded. A synchronous backend has nothing to wait for and omits this.
   * @returns a promise resolving after the first snapshot load attempt.
   */
  ready?(): Promise<void>
  /**
   * Optional: subscribe to backend-side changes (Host pushes / another
   * window's write). The listener re-renders from {@link load}.
   * @param fn - called after each backend-side change.
   * @returns the disposer.
   */
  subscribe?(fn: () => void): () => void
  /** Optional: release backend resources (event stream, timers). */
  dispose?(): void
}

/** Storage key for the legacy (pre-Host) ledger document. */
export const DEFAULT_STORAGE_KEY = 'dsh.taskBoard.v1'

/**
 * Read-only backup key the legacy document is moved to after the Host ledger
 * takes over. Keeping the bytes under another key means an upgrade never
 * silently destroys the user's old board, while the migration key itself is
 * gone and can never be imported twice.
 */
export const BACKUP_STORAGE_KEY = 'dsh.taskBoard.v1.backup'

/** Parse a persisted ledger document; invalid rows are dropped. */
export function parseLedger(raw: string | null): TaskRecord[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error('[dsh-task-board] persisted task ledger is not valid JSON; starting empty', error)
    return []
  }
  return parseRowList(parsed)
}

/**
 * localStorage-backed store (the legacy browser backend). The board no longer
 * writes through it; it survives as the migration source.
 */
export class LocalStorageTaskStore implements TaskStore {
  /**
   * @param key - storage key for the ledger document.
   * @param storage - storage backend (defaults to the global localStorage; tests inject fakes).
   */
  constructor(
    private readonly key: string = DEFAULT_STORAGE_KEY,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = globalThis.localStorage,
  ) {}

  load(): TaskRecord[] {
    if (this.storage === undefined) return []
    try {
      return parseLedger(this.storage.getItem(this.key))
    } catch (error) {
      // Storage read failures (private mode, quota) degrade to an empty ledger,
      // never break the board.
      console.error('[dsh-task-board] task ledger read failed; starting empty', error)
      return []
    }
  }

  save(tasks: readonly TaskRecord[]): void {
    if (this.storage === undefined) return
    try {
      this.storage.setItem(this.key, JSON.stringify(tasks))
    } catch (error) {
      // Write failures only skip persistence; in-memory state stays live.
      console.error('[dsh-task-board] task ledger write failed (persistence skipped)', error)
    }
  }

  clear(): void {
    if (this.storage === undefined) return
    try {
      this.storage.removeItem(this.key)
    } catch (error) {
      console.error('[dsh-task-board] task ledger clear failed', error)
    }
  }
}

/** In-memory backend (tests, and a fallback when storage is unavailable). */
export class InMemoryTaskStore implements TaskStore {
  private ledger: TaskRecord[] = []

  load(): TaskRecord[] {
    return this.ledger.map(task => ({ ...task, executions: [...task.executions] }))
  }

  save(tasks: readonly TaskRecord[]): void {
    this.ledger = tasks.map(task => ({ ...task, executions: [...task.executions] }))
  }

  clear(): void {
    this.ledger = []
  }
}
