/**
 * Host-backed store tests: snapshot adoption, one-shot localStorage
 * migration (and its idempotency), coalesced writes, conflict replay, and
 * remote-change adoption.
 */
import { describe, expect, it } from 'vitest'
import type { LedgerWriteOutcome, LedgerTransport } from '../src/core/http-ledger.ts'
import type { TaskLedger } from '../src/core/ledger.ts'
import { LEDGER_SCHEMA_VERSION } from '../src/core/ledger.ts'
import { HostTaskStore } from '../src/core/host-store.ts'
import { BACKUP_STORAGE_KEY, DEFAULT_STORAGE_KEY } from '../src/core/store.ts'
import { createTask } from '../src/core/tasks.ts'
import type { TaskRecord } from '../src/core/tasks.ts'

function task(id: string, title = id): TaskRecord {
  return createTask({ title, description: '', prompt: '' }, 1, id)
}

function ledgerOf(tasks: TaskRecord[], revision = 0): TaskLedger {
  return { schemaVersion: LEDGER_SCHEMA_VERSION, revision, updatedAt: 0, tasks }
}

/** In-memory Host transport with revision semantics matching the real routes. */
class FakeTransport implements LedgerTransport {
  ledger: TaskLedger
  reads = 0
  writes: Array<{ tasks: TaskRecord[]; expectedRevision: number }> = []
  failRead = false
  failWrite = false
  private listener: (() => void) | undefined

  constructor(ledger: TaskLedger = ledgerOf([])) {
    this.ledger = ledger
  }

  async read(): Promise<TaskLedger | undefined> {
    this.reads += 1
    if (this.failRead) return undefined
    return { ...this.ledger, tasks: this.ledger.tasks.map(row => ({ ...row })) }
  }

  async write(tasks: readonly TaskRecord[], expectedRevision: number): Promise<LedgerWriteOutcome> {
    this.writes.push({ tasks: tasks.map(row => ({ ...row })), expectedRevision })
    if (this.failWrite) return { ok: false, conflict: false }
    if (expectedRevision !== this.ledger.revision) {
      return { ok: false, conflict: true, ledger: this.ledger }
    }
    this.ledger = ledgerOf(tasks.map(row => ({ ...row })), this.ledger.revision + 1)
    return { ok: true, ledger: this.ledger }
  }

  subscribe(onChange: () => void): () => void {
    this.listener = onChange
    return () => { this.listener = undefined }
  }

  get subscribed(): boolean {
    return this.listener !== undefined
  }

  /** Simulate a write from another window plus its SSE hint. */
  pushOtherWindow(tasks: TaskRecord[]): void {
    this.ledger = ledgerOf(tasks, this.ledger.revision + 1)
    this.listener?.()
  }

  /** Deliver a change hint without moving the revision (a reconnect, say). */
  hint(): void {
    this.listener?.()
  }
}

/** Minimal localStorage stand-in. */
class FakeStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  has(key: string): boolean {
    return this.map.has(key)
  }
}

/** A store with retries captured instead of scheduled. */
function makeStore(transport: FakeTransport, storage: FakeStorage | undefined): {
  store: HostTaskStore
  retries: Array<() => void>
} {
  const retries: Array<() => void> = []
  const store = new HostTaskStore({
    transport,
    storage,
    setTimer: (fn) => { retries.push(fn); return retries.length },
    clearTimer: () => {},
  })
  return { store, retries }
}

/** Let queued promise chains settle. */
function settle(): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, 0) })
}

describe('HostTaskStore hydration', () => {
  it('adopts the Host snapshot and notifies on ready', async () => {
    const transport = new FakeTransport(ledgerOf([task('t-1')], 3))
    const { store } = makeStore(transport, undefined)
    const seen: number[] = []
    store.subscribe(() => { seen.push(store.load().length) })
    await store.ready()
    expect(store.load().map(row => row.id)).toEqual(['t-1'])
    expect(seen).toContain(1)
    expect(transport.subscribed).toBe(true)
    store.dispose()
  })

  it('keeps the board usable when the Host is unreachable, then retries', async () => {
    const transport = new FakeTransport(ledgerOf([task('t-1')], 3))
    transport.failRead = true
    const { store, retries } = makeStore(transport, undefined)
    await store.ready()
    expect(store.load()).toEqual([])
    expect(retries).toHaveLength(1)
    transport.failRead = false
    retries[0]()
    await settle()
    expect(store.load().map(row => row.id)).toEqual(['t-1'])
    store.dispose()
  })

  it('merges a task created before hydration finished instead of losing it', async () => {
    const transport = new FakeTransport(ledgerOf([task('remote')], 2))
    const { store } = makeStore(transport, undefined)
    const pending = store.ready()
    store.save([...store.load(), task('fresh')])
    await pending
    await settle()
    expect(store.load().map(row => row.id)).toEqual(['remote', 'fresh'])
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['remote', 'fresh'])
    store.dispose()
  })
})

describe('HostTaskStore writes', () => {
  it('commits the whole ledger and advances the local revision', async () => {
    const transport = new FakeTransport(ledgerOf([], 1))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    store.save([task('t-1')])
    await settle()
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['t-1'])
    expect(transport.ledger.revision).toBe(2)
    store.dispose()
  })

  it('coalesces a burst of edits into one follow-up commit', async () => {
    const transport = new FakeTransport(ledgerOf([], 1))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    store.save([task('a')])
    store.save([task('a'), task('b')])
    store.save([task('a'), task('b'), task('c')])
    await settle()
    await settle()
    expect(transport.writes.length).toBe(2)
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['a', 'b', 'c'])
    store.dispose()
  })

  it('replays a conflicting write once against the newer revision', async () => {
    const transport = new FakeTransport(ledgerOf([], 4))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    // Another window commits before this store's write lands.
    transport.ledger = ledgerOf([task('other')], 5)
    store.save([...store.load(), task('mine')])
    await settle()
    await settle()
    expect(transport.writes.map(write => write.expectedRevision)).toEqual([4, 5])
    // Last write wins, the same semantics the shared-localStorage backend had.
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['mine'])
    expect(transport.ledger.revision).toBe(6)
    store.dispose()
  })

  it('retries a failed write instead of dropping the change', async () => {
    const transport = new FakeTransport(ledgerOf([], 1))
    transport.failWrite = true
    const { store, retries } = makeStore(transport, undefined)
    await store.ready()
    store.save([task('t-1')])
    await settle()
    expect(transport.writes).toHaveLength(1)
    expect(retries.length).toBeGreaterThan(0)
    transport.failWrite = false
    retries[0]()
    await settle()
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['t-1'])
    store.dispose()
  })
})

describe('HostTaskStore remote changes', () => {
  it('adopts a snapshot pushed for another window\'s revision', async () => {
    const transport = new FakeTransport(ledgerOf([task('t-1')], 1))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    const renders: Array<readonly string[]> = []
    store.subscribe(() => { renders.push(store.load().map(row => row.id)) })
    transport.pushOtherWindow([task('t-1'), task('from-b')])
    await settle()
    expect(store.load().map(row => row.id)).toEqual(['t-1', 'from-b'])
    expect(renders.at(-1)).toEqual(['t-1', 'from-b'])
    store.dispose()
  })

  it('ignores a change hint that carries no newer revision', async () => {
    const transport = new FakeTransport(ledgerOf([], 1))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    let notifies = 0
    store.subscribe(() => { notifies += 1 })
    store.save([task('t-1')])
    await settle()
    const readsAfterWrite = transport.reads
    // The store's own save does not notify (the controller renders its own
    // mutation); a hint with an unchanged revision must not notify either.
    transport.hint()
    await settle()
    expect(transport.reads).toBe(readsAfterWrite + 1)
    expect(notifies).toBe(0)
    store.dispose()
  })

  it('stops being notified after dispose', async () => {
    const transport = new FakeTransport(ledgerOf([], 1))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    expect(transport.subscribed).toBe(true)
    store.dispose()
    expect(transport.subscribed).toBe(false)
  })
})

describe('localStorage migration', () => {
  function legacyStorage(rows: TaskRecord[]): FakeStorage {
    const storage = new FakeStorage()
    storage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(rows))
    return storage
  }

  it('imports the legacy document when the Host ledger is empty', async () => {
    const transport = new FakeTransport(ledgerOf([]))
    const storage = legacyStorage([task('old-1'), task('old-2')])
    const { store } = makeStore(transport, storage)
    await store.ready()
    expect(store.load().map(row => row.id)).toEqual(['old-1', 'old-2'])
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['old-1', 'old-2'])
    expect(transport.ledger.revision).toBe(1)
    // The original key is gone and the bytes survive under the backup key.
    expect(storage.has(DEFAULT_STORAGE_KEY)).toBe(false)
    expect(storage.has(BACKUP_STORAGE_KEY)).toBe(true)
    store.dispose()
  })

  it('does not import twice across reloads', async () => {
    const transport = new FakeTransport(ledgerOf([]))
    const storage = legacyStorage([task('old-1')])
    const first = makeStore(transport, storage)
    await first.store.ready()
    await settle()
    first.store.dispose()

    const writesAfterFirstLoad = transport.writes.length
    const second = makeStore(transport, storage)
    await second.store.ready()
    await settle()
    expect(transport.writes.length).toBe(writesAfterFirstLoad)
    expect(second.store.load().map(row => row.id)).toEqual(['old-1'])
    expect(transport.ledger.tasks.map(row => row.id)).toEqual(['old-1'])
    second.store.dispose()
  })

  it('treats a Host ledger that already holds data as authoritative', async () => {
    const transport = new FakeTransport(ledgerOf([task('host-1')], 2))
    const storage = legacyStorage([task('old-1')])
    const { store } = makeStore(transport, storage)
    await store.ready()
    expect(store.load().map(row => row.id)).toEqual(['host-1'])
    expect(transport.writes).toHaveLength(0)
    expect(storage.has(DEFAULT_STORAGE_KEY)).toBe(false)
    expect(storage.has(BACKUP_STORAGE_KEY)).toBe(true)
    store.dispose()
  })

  it('does not treat a Host ledger emptied by the user as never-written', async () => {
    const transport = new FakeTransport(ledgerOf([], 7))
    const storage = legacyStorage([task('old-1')])
    const { store } = makeStore(transport, storage)
    await store.ready()
    expect(store.load()).toEqual([])
    expect(transport.writes).toHaveLength(0)
    store.dispose()
  })

  it('keeps the legacy document when the Host rejects the import', async () => {
    const transport = new FakeTransport(ledgerOf([]))
    transport.failWrite = true
    const storage = legacyStorage([task('old-1')])
    const { store, retries } = makeStore(transport, storage)
    await store.ready()
    expect(storage.has(DEFAULT_STORAGE_KEY)).toBe(true)
    expect(retries.length).toBeGreaterThan(0)
    store.dispose()
  })

  it('migrates without storage present', async () => {
    const transport = new FakeTransport(ledgerOf([]))
    const { store } = makeStore(transport, undefined)
    await store.ready()
    expect(store.load()).toEqual([])
    expect(transport.writes).toHaveLength(0)
    store.dispose()
  })
})
