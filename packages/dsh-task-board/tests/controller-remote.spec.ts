/**
 * Controller tests for the async-backed store hooks: adopting the first Host
 * snapshot, re-rendering on store-pushed changes, and releasing the store
 * subscription on dispose.
 */
import { describe, expect, it } from 'vitest'
import { BoardController, type ControllerDeps } from '../src/core/controller.ts'
import type { ExecutionService } from '../src/core/execution.ts'
import type { TaskStore } from '../src/core/store.ts'
import { createTask, type TaskRecord } from '../src/core/tasks.ts'

const NOW = 1_700_000_000_000

const flush = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0) })

function task(id: string): TaskRecord {
  return createTask({ title: id, description: '', prompt: '' }, NOW, id)
}

/** Store whose authoritative snapshot arrives after `start()`, like the Host ledger. */
class AsyncStore implements TaskStore {
  tasks: TaskRecord[] = []
  subscribed = false
  private readyResolve: (() => void) | undefined
  private listener: (() => void) | undefined

  load(): TaskRecord[] {
    return this.tasks
  }

  save(tasks: readonly TaskRecord[]): void {
    this.tasks = [...tasks]
  }

  clear(): void {
    this.tasks = []
  }

  ready(): Promise<void> {
    return new Promise(resolve => { this.readyResolve = resolve })
  }

  subscribe(fn: () => void): () => void {
    this.listener = fn
    this.subscribed = true
    return () => {
      this.listener = undefined
      this.subscribed = false
    }
  }

  /** Publish the authoritative snapshot (the Host ledger load finishing). */
  publish(tasks: TaskRecord[]): void {
    this.tasks = tasks
    this.readyResolve?.()
  }

  /** Push a change from the backend (another window wrote). */
  push(tasks: TaskRecord[]): void {
    this.tasks = tasks
    this.listener?.()
  }
}

function makeController(): { controller: BoardController; store: AsyncStore; renders: Array<readonly string[]> } {
  const store = new AsyncStore()
  const deps: ControllerDeps = {
    store,
    exec: { run: async () => {}, reconcile: () => undefined } as unknown as ExecutionService,
    sessions: {
      list: { getSnapshot: () => ({ current: undefined }), subscribe: () => () => {} },
      open: () => {},
    },
    now: () => NOW,
    uuid: () => 'id-1',
  }
  const controller = new BoardController(deps)
  const renders: Array<readonly string[]> = []
  controller.subscribe(() => { renders.push(controller.getSnapshot().tasks.map(row => row.id)) })
  controller.start()
  return { controller, store, renders }
}

describe('BoardController with an async-backed store', () => {
  it('starts empty and adopts the snapshot once it is ready', async () => {
    const { controller, store, renders } = makeController()
    expect(controller.getSnapshot().tasks).toEqual([])
    store.publish([task('t-1'), task('t-2')])
    await flush()
    expect(controller.getSnapshot().tasks.map(row => row.id)).toEqual(['t-1', 't-2'])
    expect(renders.at(-1)).toEqual(['t-1', 't-2'])
    controller.dispose()
  })

  it('re-renders when the store pushes another window\'s change', async () => {
    const { controller, store } = makeController()
    store.publish([task('t-1')])
    await flush()
    store.push([task('t-1'), task('from-b')])
    expect(controller.getSnapshot().tasks.map(row => row.id)).toEqual(['t-1', 'from-b'])
    controller.dispose()
  })

  it('keeps the local mutation and persists through the store', async () => {
    const { controller, store } = makeController()
    store.publish([])
    await flush()
    const created = controller.createTask({ title: 'new', description: '', prompt: '' })
    expect(created).toBeDefined()
    expect(store.load().map(row => row.id)).toEqual([created?.id])
    expect(controller.getSnapshot().tasks.map(row => row.id)).toEqual([created?.id])
    controller.dispose()
  })

  it('releases the store subscription on dispose', async () => {
    const { controller, store } = makeController()
    store.publish([])
    await flush()
    expect(store.subscribed).toBe(true)
    controller.dispose()
    expect(store.subscribed).toBe(false)
    const before = controller.getSnapshot().tasks
    store.push([task('late')])
    expect(controller.getSnapshot().tasks).toBe(before)
  })
})
