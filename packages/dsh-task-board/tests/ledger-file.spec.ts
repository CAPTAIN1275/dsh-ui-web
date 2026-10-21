/**
 * Host ledger file tests: revisioned whole-ledger transactions, the
 * expected-revision guard, atomic persistence, and corrupt-file recovery.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyLedger } from '../src/core/ledger.ts'
import { defaultLedgerPath, decodeSubmittedTasks, LedgerFile } from '../src/host/ledger-file.ts'
import { createTask } from '../src/core/tasks.ts'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tb-ledger-'))
  dirs.push(dir)
  return dir
}

function ledgerIn(dir: string): LedgerFile {
  let tick = 1_000
  return new LedgerFile(join(dir, 'task-board', 'ledger.json'), () => (tick += 1))
}

function task(id: string) {
  return createTask({ title: id, description: '', prompt: '' }, 1, id)
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('defaultLedgerPath', () => {
  it('lives under $DSH_HOME/task-board/ledger.json', () => {
    const path = defaultLedgerPath('C:/dsh-home')
    expect(path.replace(/\\/g, '/')).toBe('C:/dsh-home/task-board/ledger.json')
  })
})

describe('LedgerFile.read', () => {
  it('reports a never-written ledger when the file is absent', () => {
    const file = new LedgerFile(join(tempDir(), 'task-board', 'ledger.json'), () => 42)
    const ledger = file.read()
    expect(ledger).toEqual(emptyLedger(42))
    expect(ledger.revision).toBe(0)
    expect(ledger.tasks).toEqual([])
  })

  it('round-trips a committed snapshot', () => {
    const dir = tempDir()
    const file = ledgerIn(dir)
    const committed = file.commit([task('t-1')])
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.ledger.revision).toBe(1)
    expect(file.read()).toEqual(committed.ledger)
    // Persisted as pretty JSON at the documented path, no temp file left behind.
    const raw = JSON.parse(readFileSync(join(dir, 'task-board', 'ledger.json'), 'utf8')) as { revision: number }
    expect(raw.revision).toBe(1)
    expect(readdirSync(join(dir, 'task-board'))).toEqual(['ledger.json'])
  })

  it('preserves a corrupt document beside the original and starts empty', () => {
    const dir = tempDir()
    const path = join(dir, 'task-board', 'ledger.json')
    const file = new LedgerFile(path, () => 42)
    // First commit creates the directory.
    file.commit([task('t-1')])
    writeFileSync(path, '{not json', 'utf8')
    expect(file.read()).toEqual(emptyLedger(42))
    const names = readdirSync(join(dir, 'task-board'))
    expect(names).toContain('ledger.json.corrupt-42')
  })
})

describe('LedgerFile.commit', () => {
  it('bumps the revision on every accepted whole-ledger write', () => {
    const file = ledgerIn(tempDir())
    const first = file.commit([task('t-1')])
    const second = file.commit([task('t-1'), task('t-2')])
    if (!first.ok || !second.ok) throw new Error('commit failed')
    expect(first.ledger.revision).toBe(1)
    expect(second.ledger.revision).toBe(2)
    expect(second.ledger.tasks.map(row => row.id)).toEqual(['t-1', 't-2'])
  })

  it('rejects a stale base revision and reports the current snapshot', () => {
    const file = ledgerIn(tempDir())
    file.commit([task('t-1')])
    const stale = file.commit([task('t-9')], 0)
    expect(stale.ok).toBe(false)
    if (stale.ok || !stale.conflict) return
    expect(stale.ledger.revision).toBe(1)
    expect(stale.ledger.tasks.map(row => row.id)).toEqual(['t-1'])
  })

  it('accepts the migration write based on revision 0 exactly once', () => {
    const file = ledgerIn(tempDir())
    expect(file.commit([task('t-1')], 0).ok).toBe(true)
    const second = file.commit([task('t-1')], 0)
    expect(second.ok).toBe(false)
    expect(file.read().revision).toBe(1)
  })

  it('detects an external revision bump (a second process wrote the file)', () => {
    const dir = tempDir()
    const file = ledgerIn(dir)
    file.commit([task('t-1')])
    // Simulate another writer bumping the file's revision directly.
    const path = join(dir, 'task-board', 'ledger.json')
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { revision: number }
    writeFileSync(path, JSON.stringify({ ...raw, revision: raw.revision + 1 }), 'utf8')
    const result = file.commit([task('t-2')], 1)
    expect(result.ok).toBe(false)
  })

  it('does not share row objects with the caller', () => {
    const file = ledgerIn(tempDir())
    const rows = [task('t-1')]
    file.commit(rows)
    rows[0].title = 'mutated'
    expect(file.read().tasks[0].title).toBe('t-1')
  })
})

describe('decodeSubmittedTasks', () => {
  it('accepts a valid row array', () => {
    const decoded = decodeSubmittedTasks([task('t-1')])
    expect(decoded.ok).toBe(true)
  })

  it('rejects a non-array payload', () => {
    expect(decodeSubmittedTasks({}).ok).toBe(false)
    expect(decodeSubmittedTasks(null).ok).toBe(false)
  })

  it('rejects a structurally broken row instead of silently dropping it', () => {
    expect(decodeSubmittedTasks([task('t-1'), { id: 'broken' }]).ok).toBe(false)
  })

  it('repairs an unknown status like the persisted-document path does', () => {
    const decoded = decodeSubmittedTasks([{ ...task('t-1'), status: 'weird' }])
    if (!decoded.ok) throw new Error('expected ok')
    expect(decoded.tasks[0].status).toBe('todo')
  })
})
