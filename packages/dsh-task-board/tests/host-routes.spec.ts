/**
 * Host route tests: the whole-snapshot GET, revision-guarded PUT, SSE revision
 * hints, and the transport guards, exercised over a real HTTP server.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LedgerFile } from '../src/host/ledger-file.ts'
import { registerTaskBoardRoutes, TASK_BOARD_EVENTS_PATH, TASK_BOARD_LEDGER_PATH, type WebServerFace } from '../src/host/routes.ts'
import { createTask } from '../src/core/tasks.ts'

const cleanups: Array<() => void> = []

function task(id: string) {
  return createTask({ title: id, description: '', prompt: '' }, 1, id)
}

/** Boot a real HTTP server dispatching like the dsh webserver (exact wins over prefix). */
async function boot(): Promise<{ base: string; ledger: LedgerFile; dispose: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'tb-routes-'))
  const ledger = new LedgerFile(join(dir, 'task-board', 'ledger.json'), () => 7)
  const routes: Array<{ kind: 'prefix' | 'exact'; path: string; handler: (req: never, res: never) => void | Promise<void> }> = []
  const webServer: WebServerFace = {
    register(route) {
      routes.push(route as never)
      return () => { routes.splice(routes.indexOf(route as never), 1) }
    },
  }
  const disposeRoutes = registerTaskBoardRoutes(webServer, ledger)
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const exact = routes.find(route => route.kind === 'exact' && route.path === url.pathname)
    const prefix = routes
      .filter(route => route.kind === 'prefix' && url.pathname.startsWith(route.path))
      .sort((a, b) => b.path.length - a.path.length)[0]
    const handler = exact ?? prefix
    if (handler === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    void handler.handler(req as never, res as never)
  })
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address() as AddressInfo
  const cleanup = (): void => {
    disposeRoutes()
    server.closeAllConnections()
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
  cleanups.push(cleanup)
  return { base: `http://127.0.0.1:${port}`, ledger, dispose: cleanup }
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function put(base: string, body: unknown, contentType = 'application/json'): Promise<Response> {
  return fetch(`${base}${TASK_BOARD_LEDGER_PATH}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })
}

/** Open one SSE stream and expose an incremental "read until" helper. */
async function openStream(base: string): Promise<{ readUntil: (match: RegExp) => Promise<string>; close: () => void }> {
  const controller = new AbortController()
  const response = await fetch(`${base}${TASK_BOARD_EVENTS_PATH}`, { signal: controller.signal })
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const readUntil = async (match: RegExp): Promise<string> => {
    const deadline = Date.now() + 3000
    while (!match.test(buffer)) {
      if (Date.now() > deadline) throw new Error(`timeout waiting for ${String(match)} in ${buffer}`)
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
    }
    return buffer
  }
  return { readUntil, close: () => { controller.abort() } }
}

describe('ledger routes', () => {
  it('serves the never-written snapshot over GET', async () => {
    const { base } = await boot()
    const body = await (await fetch(`${base}${TASK_BOARD_LEDGER_PATH}`)).json() as { ok: boolean; ledger: { revision: number; tasks: unknown[] } }
    expect(body.ok).toBe(true)
    expect(body.ledger.revision).toBe(0)
    expect(body.ledger.tasks).toEqual([])
  })

  it('commits a whole ledger and returns the new revision snapshot', async () => {
    const { base, ledger } = await boot()
    const response = await put(base, { expectedRevision: 0, tasks: [task('t-1')] })
    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean; ledger: { revision: number; tasks: Array<{ id: string }> } }
    expect(body.ok).toBe(true)
    expect(body.ledger.revision).toBe(1)
    expect(body.ledger.tasks.map(row => row.id)).toEqual(['t-1'])
    expect(ledger.read().revision).toBe(1)
  })

  it('answers a stale write with 409 plus the current snapshot (no clobbering)', async () => {
    const { base, ledger } = await boot()
    await put(base, { expectedRevision: 0, tasks: [task('t-1')] })
    const response = await put(base, { expectedRevision: 0, tasks: [task('t-2')] })
    expect(response.status).toBe(409)
    const body = await response.json() as { ok: boolean; conflict: boolean; ledger: { revision: number; tasks: Array<{ id: string }> } }
    expect(body.conflict).toBe(true)
    expect(body.ledger.revision).toBe(1)
    expect(body.ledger.tasks.map(row => row.id)).toEqual(['t-1'])
    expect(ledger.read().tasks.map(row => row.id)).toEqual(['t-1'])
  })

  it('rejects malformed payloads and wrong content types', async () => {
    const { base } = await boot()
    expect((await put(base, { tasks: [{ id: 'broken' }] })).status).toBe(400)
    expect((await put(base, { tasks: 'nope' })).status).toBe(400)
    expect((await put(base, { tasks: [] }, 'text/plain')).status).toBe(415)
    expect((await fetch(`${base}${TASK_BOARD_LEDGER_PATH}`, { method: 'DELETE' })).status).toBe(405)
    expect((await fetch(`${base}/task-board/unknown`)).status).toBe(404)
  })

  it('pushes a revision hint on connect and on every commit', async () => {
    const { base } = await boot()
    const stream = await openStream(base)
    const initial = await stream.readUntil(/event: change/)
    expect(initial).toContain('"revision":0')
    await put(base, { expectedRevision: 0, tasks: [task('t-1')] })
    const afterCommit = await stream.readUntil(/"revision":1/)
    expect(afterCommit).toContain('"revision":1')
    stream.close()
  })
})
