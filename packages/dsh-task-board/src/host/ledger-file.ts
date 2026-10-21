/**
 * Host-side authoritative task ledger: one JSON document under
 * `$DSH_HOME/task-board/ledger.json`, written only through whole-ledger
 * transactions.
 *
 * Every accepted write is a read-modify-write: the file is re-read, the
 * revision is bumped by one, and the full snapshot is persisted atomically
 * (temp file + rename) so a crash mid-write can never leave a truncated
 * ledger. The optional `expectedRevision` guard makes concurrent writers
 * detectable: a writer whose base revision is stale gets a conflict plus the
 * current snapshot instead of silently clobbering a newer one.
 *
 * Node-only (the Host half); the browser half never touches this module.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { decodeLedger, emptyLedger, LEDGER_SCHEMA_VERSION, normalizeTaskRecord, type TaskLedger } from '../core/ledger.ts'
import type { TaskRecord } from '../core/tasks.ts'

/** Result of one whole-ledger commit attempt. */
export type LedgerCommit =
  | { ok: true; ledger: TaskLedger }
  /** The caller's base revision is stale; `ledger` is the current snapshot. */
  | { ok: false; conflict: true; ledger: TaskLedger }
  /** The submitted rows are not a usable ledger (nothing was written). */
  | { ok: false; conflict: false; error: string }

/** Read one process environment variable without depending on Node's global typings. */
function envValue(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}

/** Default ledger location: `$DSH_HOME/task-board/ledger.json`. */
export function defaultLedgerPath(home: string | undefined = envValue('DSH_HOME')): string {
  return join(home ?? join(homedir(), '.dsh'), 'task-board', 'ledger.json')
}

/**
 * Decode a submitted write body into validated rows. Rows are repaired by the
 * same rules persisted documents use; a structurally broken row rejects the
 * whole write rather than being dropped, so a client bug cannot silently
 * delete a task.
 * @param values - the submitted row array.
 * @returns the repaired rows, or an error message.
 */
export function decodeSubmittedTasks(values: unknown): { ok: true; tasks: TaskRecord[] } | { ok: false; error: string } {
  if (!Array.isArray(values)) return { ok: false, error: 'tasks must be an array' }
  const tasks: TaskRecord[] = []
  for (const value of values) {
    const task = normalizeTaskRecord(value)
    if (task === undefined) return { ok: false, error: 'invalid task row' }
    tasks.push(task)
  }
  return { ok: true, tasks }
}

/** File-backed ledger with revision guard and atomic writes. */
export class LedgerFile {
  /**
   * @param path - absolute ledger document path.
   * @param now - clock (injectable for tests).
   */
  constructor(
    private readonly path: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** @returns the ledger document path this instance owns. */
  get filePath(): string {
    return this.path
  }

  /**
   * Read the current snapshot from disk. A missing file is the never-written
   * ledger (revision 0); an unreadable/corrupt file is preserved next to the
   * original and treated as never-written, so the board can recover without
   * the Host crashing.
   * @returns the authoritative snapshot.
   */
  read(): TaskLedger {
    let raw: string
    try {
      raw = readFileSync(this.path, 'utf8')
    } catch {
      return emptyLedger(this.now())
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      this.quarantine()
      console.error('[dsh-task-board] host ledger is not valid JSON; preserved and started empty', error)
      return emptyLedger(this.now())
    }
    const ledger = decodeLedger(parsed)
    if (ledger === undefined || !Array.isArray((parsed as { tasks?: unknown }).tasks)) {
      this.quarantine()
      console.error('[dsh-task-board] host ledger has an unusable shape; preserved and started empty')
      return emptyLedger(this.now())
    }
    return ledger
  }

  /**
   * Whole-ledger transaction: re-read the file, verify the caller's base
   * revision, bump the revision, and persist the new snapshot atomically.
   * @param tasks - the complete task list to store.
   * @param expectedRevision - the revision the caller based its write on
   *   (undefined = accept unconditionally, used only by the migration).
   * @returns the new snapshot, or the conflict/invalid outcome.
   */
  commit(tasks: readonly TaskRecord[], expectedRevision?: number): LedgerCommit {
    const current = this.read()
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      return { ok: false, conflict: true, ledger: current }
    }
    const ledger: TaskLedger = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      revision: current.revision + 1,
      updatedAt: this.now(),
      tasks: tasks.map(task => ({ ...task, executions: [...task.executions] })),
    }
    this.write(ledger)
    return { ok: true, ledger }
  }

  /** Persist one snapshot atomically (temp file in the same directory + rename). */
  private write(ledger: TaskLedger): void {
    mkdirSync(dirname(this.path), { recursive: true })
    const temp = `${this.path}.tmp`
    writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
    renameSync(temp, this.path)
  }

  /** Preserve an unreadable ledger beside the original before starting empty. */
  private quarantine(): void {
    try {
      renameSync(this.path, `${this.path}.corrupt-${this.now()}`)
    } catch {
      // Nothing to preserve (or the rename is not permitted): start empty.
    }
  }
}
