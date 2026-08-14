/**
 * Controller tests: orchestration — persistence, view state, navigation
 * awareness, and the full run loop (running → started(sessionId) → settled).
 */
import { describe, expect, it, vi } from 'vitest'
import { BoardController, type ControllerDeps } from '../src/core/controller.ts'
import { ExecutionService, type ExecutionEvent } from '../src/core/execution.ts'
import { InMemoryTaskStore } from '../src/core/store.ts'
import { createTask } from '../src/core/tasks.ts'

const NOW = 1_700_000_000_000
let nextId = 0
const uuid = (): string => { nextId += 1; return `id-${nextId}` }

/** Flush pending microtasks (async controller paths). */
const flush = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0) })

/** Controllable sessions face (selection + open). */
class FakeSessions {
  current: string | undefined = undefined
  openCalls: string[] = []
  private listeners = new Set<() => void>()
  list = {
    getSnapshot: (): { current: string | undefined } => ({ current: this.current }),
    subscribe: (fn: () => void): (() => void) => {
      this.listeners.add(fn)
      return () => { this.listeners.delete(fn) }
    },
  }
  open(id: string): void {
    this.openCalls.push(id)
    this.setCurrent(id)
  }
  setCurrent(id: string | undefined): void {
    this.current = id
    for (const fn of [...this.listeners]) fn()
  }
}

/** Controllable ExecutionService stub: captures run calls, fires events on demand. */
class StubExec {
  runCalls: Array<{ taskId: string; executionId: string; fire: (event: ExecutionEvent) => void }> = []
  reconcileResult: ExecutionEvent | undefined = undefined
  async run(task: { id: string }, execution: { id: string }, onEvent: (event: ExecutionEvent) => void): Promise<void> {
    this.runCalls.push({ taskId: task.id, executionId: execution.id, fire: onEvent })
  }
  reconcile(): ExecutionEvent | undefined {
    return this.reconcileResult
  }
}

function makeController(stub = new StubExec()) {
  const sessions = new FakeSessions()
  const store = new InMemoryTaskStore()
  const deps: ControllerDeps = {
    store,
    exec: stub as unknown as ExecutionService,
    sessions,
    now: () => NOW,
    uuid,
  }
  const controller = new BoardController(deps)
  controller.start()
  return { controller, sessions, store, stub }
}

function seedTask(store: InMemoryTaskStore, overrides: Partial<Parameters<typeof createTask>[0] & { id: string }> = {}) {
  const task = createTask(
    { title: '任务A', description: '描述', prompt: 'prompt A', ...overrides },
    NOW,
    overrides.id ?? 'task-a',
  )
  store.save([task])
  return task
}

describe('BoardController lifecycle', () => {
  it('loads the persisted ledger on start', () => {
    const { controller, store } = makeController()
    seedTask(store)
    const reloaded = new BoardController({
      store, exec: new StubExec() as unknown as ExecutionService,
      sessions: new FakeSessions(), now: () => NOW, uuid,
    })
    reloaded.start()
    expect(reloaded.getSnapshot().tasks.map(task => task.id)).toEqual(['task-a'])
  })

  it('dispose unsubscribes (no more notifications)', () => {
    const { controller, sessions } = makeController()
    let count = 0
    controller.subscribe(() => { count += 1 })
    controller.dispose()
    sessions.setCurrent('s-1')
    expect(count).toBe(0)
  })
})

describe('task mutations', () => {
  it('creates, persists, and rejects blank titles', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: ' 新任务 ', description: '', prompt: '' })
    expect(task).toBeDefined()
    expect(controller.getSnapshot().tasks).toHaveLength(1)
    expect(store.load()[0].title).toBe('新任务')
    expect(controller.createTask({ title: '   ', description: '', prompt: '' })).toBeUndefined()
  })

  it('deletes and clears the selection when the selected task is removed', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.openTask(task.id)
    controller.deleteTask(task.id)
    expect(controller.getSnapshot().tasks).toHaveLength(0)
    expect(controller.getSnapshot().selectedTaskId).toBeUndefined()
    expect(store.load()).toEqual([])
  })

  it('updates and moves tasks with persistence', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.updateTask(task.id, { title: 'y' })
    controller.moveTask(task.id, 'backlog')
    const persisted = store.load()[0]
    expect(persisted.title).toBe('y')
    expect(persisted.status).toBe('backlog')
  })
})

describe('view state', () => {
  it('toggles the board and reflects it in the snapshot', () => {
    const { controller } = makeController()
    expect(controller.getSnapshot().boardOpen).toBe(false)
    controller.openBoard()
    expect(controller.getSnapshot().boardOpen).toBe(true)
    controller.openBoard() // idempotent
    expect(controller.getSnapshot().boardOpen).toBe(true)
    controller.closeBoard()
    expect(controller.getSnapshot().boardOpen).toBe(false)
    controller.toggleBoard()
    expect(controller.getSnapshot().boardOpen).toBe(true)
  })

  it('closes the board when the user navigates to a session', () => {
    const { controller, sessions } = makeController()
    sessions.setCurrent('s-1')
    controller.openBoard()
    expect(controller.getSnapshot().boardOpen).toBe(true)
    sessions.setCurrent('s-2')
    expect(controller.getSnapshot().boardOpen).toBe(false)
  })

  it('closes the board when a new session is started (selection cleared)', () => {
    const { controller, sessions } = makeController()
    sessions.setCurrent('s-1')
    controller.openBoard()
    sessions.setCurrent(undefined)
    expect(controller.getSnapshot().boardOpen).toBe(false)
  })

  it('stays open on unrelated session-list changes (status updates of the same selection)', () => {
    const { controller, sessions } = makeController()
    sessions.setCurrent('s-1')
    controller.openBoard()
    // A notification with an unchanged selection must not close the board.
    for (const fn of [...(sessions as unknown as { listeners: Set<() => void> }).listeners]) fn()
    expect(controller.getSnapshot().boardOpen).toBe(true)
  })

  it('openTask/closeTask manage the selection', () => {
    const { controller } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.openTask(task.id)
    expect(controller.getSnapshot().selectedTaskId).toBe(task.id)
    controller.closeTask()
    expect(controller.getSnapshot().selectedTaskId).toBeUndefined()
  })

  it('openSession selects the session on the runtime', () => {
    const { controller, sessions } = makeController()
    controller.openSession('exec-session')
    expect(sessions.openCalls).toEqual(['exec-session'])
  })
})

describe('run loop', () => {
  it('moves to running, attaches the session id, and settles on completion', async () => {
    const stub = new StubExec()
    const { controller, store, stub: exec } = makeController(stub)
    const task = controller.createTask({ title: '任务A', description: '', prompt: '干活' })!
    const taskId = task.id

    await controller.runTask(taskId)
    expect(exec.runCalls).toHaveLength(1)
    expect(exec.runCalls[0].taskId).toBe(taskId)
    const executionId = exec.runCalls[0].executionId
    expect(store.load()[0].status).toBe('running')

    // The execution service reports the session…
    exec.runCalls[0].fire({ kind: 'started', taskId, executionId, sessionId: 's-9' })
    expect(store.load()[0].executions[0].sessionId).toBe('s-9')
    expect(store.load()[0].status).toBe('running')

    // A second run call while running is ignored.
    await controller.runTask(taskId)
    expect(exec.runCalls).toHaveLength(1)

    // …and settles it.
    exec.runCalls[0].fire({ kind: 'settled', taskId, executionId, outcome: 'succeeded' })
    expect(store.load()[0].status).toBe('done')
    expect(store.load()[0].executions[0].result).toBe('succeeded')
  })

  it('settles failed tasks into the failed column', async () => {
    const stub = new StubExec()
    const { controller, store, stub: exec } = makeController(stub)
    const task = controller.createTask({ title: '任务A', description: '', prompt: '干活' })!
    await controller.runTask(task.id)
    exec.runCalls[0].fire({ kind: 'settled', taskId: task.id, executionId: exec.runCalls[0].executionId, outcome: 'failed', error: 'boom' })
    expect(store.load()[0].status).toBe('failed')
    expect(store.load()[0].executions[0].error).toBe('boom')
  })

  it('rerunTask re-plans a settled task to todo before running again', async () => {
    const stub = new StubExec()
    const { controller, stub: exec } = makeController(stub)
    const task = controller.createTask({ title: '任务A', description: '', prompt: '干活' })!
    await controller.runTask(task.id)
    exec.runCalls[0].fire({ kind: 'settled', taskId: task.id, executionId: exec.runCalls[0].executionId, outcome: 'failed' })
    expect(controller.getSnapshot().tasks[0].status).toBe('failed')
    await controller.rerunTask(task.id)
    expect(controller.getSnapshot().tasks[0].status).toBe('running')
    expect(exec.runCalls).toHaveLength(2)
  })

  it('reconciles running tasks left over from a previous load', async () => {
    const stub = new StubExec()
    stub.reconcileResult = { kind: 'settled', taskId: 'task-a', executionId: 'e1', outcome: 'cancelled', error: 'gone' }
    const { controller, store } = makeController(stub)
    const task = seedTask(store, { id: 'task-a' })
    store.save([{ ...task, status: 'running', executions: [{ id: 'e1', sessionId: 's-1', startedAt: NOW, endedAt: undefined, result: undefined, error: undefined }] }])
    const reloaded = new BoardController({
      store, exec: stub as unknown as ExecutionService,
      sessions: new FakeSessions(), now: () => NOW, uuid,
    })
    reloaded.start()
    await flush()
    expect(reloaded.getSnapshot().tasks[0].status).toBe('todo')
  })

  it('settles an orphaned running execution on the next session-list change', async () => {
    const stub = new StubExec()
    stub.reconcileResult = { kind: 'settled', taskId: 'task-a', executionId: 'e1', outcome: 'cancelled', error: 'gone' }
    const store = new InMemoryTaskStore()
    const task = seedTask(store, { id: 'task-a' })
    store.save([{ ...task, status: 'running', executions: [{ id: 'e1', sessionId: 's-1', startedAt: NOW, endedAt: undefined, result: undefined, error: undefined }] }])
    const sessions = new FakeSessions()
    const controller = new BoardController({
      store, exec: stub as unknown as ExecutionService,
      sessions, now: () => NOW, uuid, reconcileDebounceMs: 0,
    })
    // Start resolves while the exec still reports nothing to settle…
    stub.reconcileResult = undefined
    controller.start()
    await flush()
    expect(controller.getSnapshot().tasks[0].status).toBe('running')
    // …then a later list change settles the orphan without a page reload.
    stub.reconcileResult = { kind: 'settled', taskId: 'task-a', executionId: 'e1', outcome: 'cancelled', error: 'gone' }
    sessions.setCurrent('s-new')
    await flush()
    await flush()
    expect(controller.getSnapshot().tasks[0].status).toBe('todo')
  })

  it('coalesces a burst of session-list changes into one reconcile pass', async () => {
    let reconcileCalls = 0
    const stub = {
      runCalls: [],
      run: async () => {},
      reconcile: () => { reconcileCalls += 1; return undefined },
    }
    const store = new InMemoryTaskStore()
    const task = seedTask(store, { id: 'task-a' })
    store.save([{ ...task, status: 'running', executions: [{ id: 'e1', sessionId: 's-1', startedAt: NOW, endedAt: undefined, result: undefined, error: undefined }] }])
    const sessions = new FakeSessions()
    const controller = new BoardController({
      store, exec: stub as unknown as ExecutionService,
      sessions, now: () => NOW, uuid, reconcileDebounceMs: 20,
    })
    controller.start()
    await flush()
    const before = reconcileCalls
    for (let i = 0; i < 5; i += 1) sessions.setCurrent('s-' + i)
    await new Promise(resolve => { setTimeout(resolve, 50) })
    expect(reconcileCalls - before).toBe(1)
  })

  it('keeps a page-launched run running on list updates; only the watch settles it', async () => {
    const stub = new StubExec()
    const { controller, sessions, store, stub: exec } = makeController(stub)
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    // Start a run; attach its session id.
    await controller.runTask(task.id)
    const executionId = exec.runCalls[0].executionId
    exec.runCalls[0].fire({ kind: 'started', taskId: task.id, executionId, sessionId: 's-1' })
    expect(store.load()[0].status).toBe('running')

    // A session-list notification (the executing session appearing in the
    // list while its turn has not started yet) must NOT settle the run via
    // reconciliation: a freshly created session is idle, not completed.
    stub.reconcileResult = { kind: 'settled', taskId: task.id, executionId, outcome: 'succeeded' }
    sessions.setCurrent('s-2')
    await flush()
    expect(store.load()[0].status).toBe('running')

    // The live watch settles on the turn boundary.
    exec.runCalls[0].fire({ kind: 'settled', taskId: task.id, executionId, outcome: 'succeeded' })
    expect(store.load()[0].status).toBe('done')
    expect(store.load()[0].executions[0].result).toBe('succeeded')
  })
})

describe('scheduling', () => {
  it('setSchedule enables a rule and computes the next run instant', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    expect(controller.setSchedule(task.id, { enabled: true, cron: '* * * * *' })).toBe(true)
    const persisted = store.load()[0]
    expect(persisted.schedule?.enabled).toBe(true)
    expect(persisted.schedule?.cron).toBe('* * * * *')
    expect(persisted.schedule?.nextRunAt).toBeDefined()
  })

  it('rejects blank or invalid cron expressions without touching state', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    expect(controller.setSchedule(task.id, { enabled: true, cron: 'not a cron' })).toBe(false)
    expect(controller.setSchedule(task.id, { enabled: true, cron: '   ' })).toBe(false)
    expect(controller.setSchedule(task.id, { enabled: true })).toBe(false) // no existing cron → blank → rejected
    expect(store.load()[0].schedule).toBeUndefined()
  })

  it('disabling a rule clears the next run instant but keeps the cron', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.setSchedule(task.id, { enabled: true, cron: '* * * * *' })
    expect(controller.setSchedule(task.id, { enabled: false })).toBe(true)
    const persisted = store.load()[0]
    expect(persisted.schedule?.enabled).toBe(false)
    expect(persisted.schedule?.cron).toBe('* * * * *')
    expect(persisted.schedule?.nextRunAt).toBeUndefined()
  })

  it('recomputes the next run when the cron changes while enabled', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.setSchedule(task.id, { enabled: true, cron: '* * * * *' })
    const first = store.load()[0].schedule?.nextRunAt
    controller.setSchedule(task.id, { cron: '*/5 * * * *' })
    const second = store.load()[0].schedule?.nextRunAt
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
  })

  it('applyScheduleNextRun rolls the schedule forward for the scheduler', () => {
    const { controller, store } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    controller.setSchedule(task.id, { enabled: true, cron: '* * * * *' })
    controller.applyScheduleNextRun(task.id, 1_234_567_890, 1_234_500_000)
    const persisted = store.load()[0]
    expect(persisted.schedule?.nextRunAt).toBe(1_234_567_890)
    expect(persisted.schedule?.lastTriggeredAt).toBe(1_234_500_000)
  })

  it('applyScheduleNextRun is a no-op for tasks without a schedule rule', () => {
    const { controller } = makeController()
    const task = controller.createTask({ title: 'x', description: '', prompt: '' })!
    expect(() => controller.applyScheduleNextRun(task.id, 1, 2)).not.toThrow()
    expect(controller.getSnapshot().tasks[0].schedule).toBeUndefined()
  })
})
