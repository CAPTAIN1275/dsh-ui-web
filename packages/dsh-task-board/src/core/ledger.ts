/**
 * Task-ledger wire contract shared by the Host ledger file and the browser
 * client: the versioned snapshot shape, row validation/repair, and the
 * empty-ledger rule the localStorage migration keys on.
 *
 * Framework-free and DOM-free, so the Host half (ledger file + HTTP routes),
 * the browser half (remote transport + store), and the unit tests all read the
 * same rules.
 */
import { isValidCron } from './schedule.ts'
import type { ScheduleRule, TaskRecord, TaskStatus } from './tasks.ts'
import { isTaskStatus } from './tasks.ts'

/** Schema version stamped into every ledger document this plugin writes. */
export const LEDGER_SCHEMA_VERSION = 1

/**
 * One authoritative ledger snapshot.
 *
 * `revision` is monotone across commits: the Host bumps it on every accepted
 * whole-ledger write, and the browser treats any other revision as "re-pull
 * the snapshot". Revision 0 means "never written" — the only state in which
 * the localStorage migration may import rows.
 */
export interface TaskLedger {
  /** Document schema version (see {@link LEDGER_SCHEMA_VERSION}). */
  schemaVersion: number
  /** Monotone commit counter; 0 = the Host has never accepted a write. */
  revision: number
  /** Wall-clock instant (ms epoch) of the last accepted write. */
  updatedAt: number
  /** Every task row, in board order. */
  tasks: TaskRecord[]
}

/** A fresh, never-written ledger snapshot. */
export function emptyLedger(now = 0): TaskLedger {
  return { schemaVersion: LEDGER_SCHEMA_VERSION, revision: 0, updatedAt: now, tasks: [] }
}

/**
 * Whether a snapshot counts as "Host has no data yet" for the migration: the
 * Host never committed anything. A revision above 0 with an empty task list is
 * a real ledger (the user deleted every task) and must never be overwritten by
 * a legacy import.
 * @param ledger - the snapshot read from the Host.
 * @returns true when the ledger was never written.
 */
export function isLedgerEmpty(ledger: TaskLedger): boolean {
  return ledger.revision === 0 && ledger.tasks.length === 0
}

/**
 * Structural row check with the status left unvalidated (see
 * {@link normalizeTaskRecord}). The `schedule` field is deliberately NOT
 * checked here: a malformed schedule never drops the task row —
 * {@link normalizeSchedule} repairs or drops the schedule alone.
 */
function isTaskRecordShape(value: unknown): value is Omit<TaskRecord, 'status'> & { status: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id === '') return false
  if (typeof record.title !== 'string') return false
  if (typeof record.description !== 'string') return false
  if (typeof record.prompt !== 'string') return false
  if (typeof record.createdAt !== 'number') return false
  if (typeof record.updatedAt !== 'number') return false
  if (!Array.isArray(record.executions)) return false
  for (const execution of record.executions) {
    if (typeof execution !== 'object' || execution === null) return false
    const entry = execution as Record<string, unknown>
    if (typeof entry.id !== 'string') return false
    if (entry.sessionId !== undefined && typeof entry.sessionId !== 'string') return false
    if (typeof entry.startedAt !== 'number') return false
    if (entry.endedAt !== undefined && typeof entry.endedAt !== 'number') return false
    if (entry.result !== undefined && entry.result !== 'succeeded' && entry.result !== 'failed' && entry.result !== 'cancelled') return false
    if (entry.error !== undefined && typeof entry.error !== 'string') return false
  }
  return true
}

/** A task record is structurally valid if it round-trips through the UI. */
export function isTaskRecord(value: unknown): value is TaskRecord {
  return isTaskRecordShape(value) && isTaskStatus(value.status)
}

/** Normalize an unknown persisted status back into the closed status union. */
function normalizeStatus(status: unknown): TaskStatus {
  return isTaskStatus(status) ? status : 'todo'
}

/**
 * Repair a persisted schedule rule: drop rules without a usable cron string,
 * coerce booleans/numbers, and leave `nextRunAt`/`lastTriggeredAt` undefined
 * when missing (a fresh recompute or the next tick fixes them).
 */
function normalizeSchedule(schedule: unknown): ScheduleRule | undefined {
  if (typeof schedule !== 'object' || schedule === null) return undefined
  const rule = schedule as Record<string, unknown>
  // Reject (drop) a schedule whose cron is not a well-formed 5-field
  // expression: a malformed rule would otherwise linger as a never-firing
  // schedule instead of being dropped for later repair.
  if (typeof rule.cron !== 'string') return undefined
  if (rule.cron.trim() === '' || !isValidCron(rule.cron)) return undefined
  return {
    enabled: rule.enabled === true,
    cron: rule.cron,
    nextRunAt: typeof rule.nextRunAt === 'number' ? rule.nextRunAt : undefined,
    lastTriggeredAt: typeof rule.lastTriggeredAt === 'number' ? rule.lastTriggeredAt : undefined,
  }
}

/**
 * Validate and repair one unknown task row. Unknown statuses land in `todo`
 * instead of dropping the row; the schedule is repaired field by field; every
 * other field must be valid, otherwise the row is dropped.
 * @param value - a candidate row from a persisted document or a write body.
 * @returns the repaired row, or undefined when the row is unusable.
 */
export function normalizeTaskRecord(value: unknown): TaskRecord | undefined {
  if (!isTaskRecordShape(value)) return undefined
  // Always (re)assign the schedule: a repair that returns undefined must clear
  // a malformed persisted rule rather than leave it in the row.
  const task: TaskRecord = { ...value, status: normalizeStatus(value.status) }
  task.schedule = normalizeSchedule(value.schedule)
  return task
}

/** Parse a stored JSON array document into a validated ledger row list. */
export function parseRowList(parsed: unknown): TaskRecord[] {
  if (!Array.isArray(parsed)) {
    console.error('[dsh-task-board] persisted task ledger is not an array; starting empty')
    return []
  }
  const tasks: TaskRecord[] = []
  for (const row of parsed) {
    const task = normalizeTaskRecord(row)
    if (task === undefined) {
      console.warn('[dsh-task-board] dropping invalid task row from persisted ledger', row)
      continue
    }
    tasks.push(task)
  }
  return tasks
}

/**
 * Decode a ledger snapshot off the wire. Unknown or malformed fields degrade
 * to the empty/never-written snapshot instead of throwing; rows go through the
 * same repair pass as persisted documents.
 * @param value - a candidate snapshot (a parsed GET response body, say).
 * @returns the decoded snapshot, or undefined when it is not an object.
 */
export function decodeLedger(value: unknown): TaskLedger | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const revision = typeof record.revision === 'number' && Number.isFinite(record.revision) && record.revision >= 0
    ? Math.floor(record.revision)
    : 0
  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : LEDGER_SCHEMA_VERSION,
    revision,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    tasks: parseRowList(record.tasks),
  }
}
