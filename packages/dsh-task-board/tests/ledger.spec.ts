/**
 * Ledger contract tests: snapshot decoding, the never-written rule the
 * localStorage migration depends on, and row repair shared with the Host.
 */
import { describe, expect, it } from 'vitest'
import {
  decodeLedger, emptyLedger, isLedgerEmpty, isTaskRecord, LEDGER_SCHEMA_VERSION, normalizeTaskRecord,
} from '../src/core/ledger.ts'
import { createTask, withSchedule } from '../src/core/tasks.ts'

function sampleTask() {
  return createTask({ title: 'A', description: 'd', prompt: 'p' }, 1, 't-1')
}

describe('emptyLedger', () => {
  it('is a never-written snapshot with the current schema version', () => {
    expect(emptyLedger(5)).toEqual({ schemaVersion: LEDGER_SCHEMA_VERSION, revision: 0, updatedAt: 5, tasks: [] })
  })
})

describe('isLedgerEmpty', () => {
  it('treats only the never-written snapshot as empty', () => {
    expect(isLedgerEmpty(emptyLedger())).toBe(true)
    expect(isLedgerEmpty({ ...emptyLedger(), revision: 3 })).toBe(false)
    expect(isLedgerEmpty({ ...emptyLedger(), tasks: [sampleTask()] })).toBe(false)
  })
})

describe('decodeLedger', () => {
  it('decodes a full snapshot and repairs its rows', () => {
    const ledger = decodeLedger({
      schemaVersion: 7,
      revision: 4,
      updatedAt: 99,
      tasks: [sampleTask(), { ...sampleTask(), id: 't-2', status: 'weird' }, { id: 'broken' }],
    })
    expect(ledger).toBeDefined()
    expect(ledger?.schemaVersion).toBe(7)
    expect(ledger?.revision).toBe(4)
    expect(ledger?.updatedAt).toBe(99)
    expect(ledger?.tasks).toHaveLength(2)
    expect(ledger?.tasks[1].status).toBe('todo')
  })

  it('defaults missing/garbage header fields instead of throwing', () => {
    const ledger = decodeLedger({ tasks: [] })
    expect(ledger).toEqual({ schemaVersion: LEDGER_SCHEMA_VERSION, revision: 0, updatedAt: 0, tasks: [] })
    expect(decodeLedger({ revision: -3, tasks: 'nope' })?.revision).toBe(0)
    expect(decodeLedger({ revision: 2.9, tasks: [] })?.revision).toBe(2)
  })

  it('rejects non-object snapshots', () => {
    expect(decodeLedger(null)).toBeUndefined()
    expect(decodeLedger([])).toBeUndefined()
    expect(decodeLedger('x')).toBeUndefined()
  })
})

describe('normalizeTaskRecord', () => {
  it('round-trips a valid row', () => {
    const task = withSchedule(sampleTask(), { enabled: true, cron: '0 9 * * *', nextRunAt: 10 }, 2)
    expect(normalizeTaskRecord(task)).toEqual(task)
    expect(isTaskRecord(normalizeTaskRecord(task))).toBe(true)
  })

  it('repairs a malformed schedule without dropping the row', () => {
    const repaired = normalizeTaskRecord({ ...sampleTask(), schedule: { enabled: 1, cron: 'nope' } })
    expect(repaired?.id).toBe('t-1')
    expect(repaired?.schedule).toBeUndefined()
  })

  it('drops structurally broken rows', () => {
    expect(normalizeTaskRecord({ id: 'x' })).toBeUndefined()
    expect(normalizeTaskRecord({ ...sampleTask(), executions: [{ id: 3 }] })).toBeUndefined()
    expect(normalizeTaskRecord(null)).toBeUndefined()
  })
})
