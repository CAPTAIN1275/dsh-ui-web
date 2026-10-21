/**
 * Host HTTP/SSE routes for the task-board ledger.
 *
 * The browser half owns no authoritative state any more: it reads the whole
 * snapshot, writes whole-ledger transactions, and learns about other windows'
 * writes from a revision-only SSE stream.
 *
 * Routes (all registered on the shared dsh webserver):
 *   GET  /task-board/ledger   read the full snapshot
 *   PUT  /task-board/ledger   whole-ledger transaction (read-modify-write)
 *   GET  /task-board/events   SSE: `change` events carrying only `{ revision }`
 *
 * The stream never carries task rows: a client that sees a revision it does
 * not know re-pulls the snapshot, so a large ledger is never pushed twice and
 * a missed event only costs one read.
 * @module @captain1275/dsh-client-ui-task-board/host/routes
 */
import type { TaskLedger } from '../core/ledger.ts'
import { decodeSubmittedTasks, type LedgerFile } from './ledger-file.ts'

/** Browser-facing route prefix owned by this plugin. */
export const TASK_BOARD_ROUTE_PREFIX = '/task-board'

/** Full-snapshot read/write route. */
export const TASK_BOARD_LEDGER_PATH = `${TASK_BOARD_ROUTE_PREFIX}/ledger`

/** Revision-only SSE stream. */
export const TASK_BOARD_EVENTS_PATH = `${TASK_BOARD_ROUTE_PREFIX}/events`

/** Request body ceiling: a board of long prompts still fits well under this. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

/** Heartbeat interval keeping idle proxies from closing an SSE stream. */
const HEARTBEAT_MS = 25_000

/**
 * Structural face of the Node request the routes read. Declared here rather
 * than imported from `node:http` so the Host half does not depend on a type
 * package the build tsconfig does not load (see `node-builtins.d.ts`).
 */
export interface RouteRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  on(event: string, listener: (...args: any[]) => void): void
  destroy(): void
}

/** Structural face of the Node response the routes write. */
export interface RouteResponse {
  writeHead(status: number, headers?: Record<string, string | number>): void
  write(chunk: string): unknown
  end(chunk?: string): void
}

/** Structural face of the shared dsh webserver route registry. */
export interface WebServerFace {
  /**
   * Register one route.
   * @param route - kind determines prefix vs exact matching.
   * @returns the route disposer.
   */
  register(route: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: RouteRequest, res: RouteResponse) => void | Promise<void>
  }): () => void
}

/** Write one JSON response. */
function sendJson(res: RouteResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Read a request body up to {@link MAX_BODY_BYTES}. */
function readBody(req: RouteRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: { toString(encoding: string): string }) => {
      body += chunk.toString('utf8')
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** Push one revision hint to a subscriber stream. */
function pushRevision(res: RouteResponse, revision: number): void {
  res.write(`event: change\ndata: ${JSON.stringify({ revision })}\n\n`)
}

/**
 * Register the ledger routes and their event stream.
 * @param webServer - the shared webserver route registry.
 * @param ledger - the Host ledger this route family serves.
 * @returns the disposer removing the routes and closing open streams.
 */
export function registerTaskBoardRoutes(webServer: WebServerFace, ledger: LedgerFile): () => void {
  const subscribers = new Set<RouteResponse>()
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stopHeartbeatIfIdle = (): void => {
    if (subscribers.size > 0 || heartbeat === undefined) return
    clearInterval(heartbeat)
    heartbeat = undefined
  }

  const broadcast = (current: TaskLedger): void => {
    for (const res of subscribers) pushRevision(res, current.revision)
  }

  const openStream = (req: RouteRequest, res: RouteResponse): void => {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-content-type-options': 'nosniff',
    })
    res.write('retry: 2000\n\n')
    // Tell a (re)connecting client which revision the Host is at; it compares
    // the number with its own and re-pulls only when it differs.
    pushRevision(res, ledger.read().revision)
    subscribers.add(res)
    if (heartbeat === undefined) {
      heartbeat = setInterval(() => {
        for (const subscriber of subscribers) subscriber.write(': ping\n\n')
      }, HEARTBEAT_MS)
      // A Host process must not stay alive only for a heartbeat timer.
      const timer = heartbeat as unknown as { unref?: () => void }
      timer.unref?.()
    }
    req.on('close', () => {
      subscribers.delete(res)
      stopHeartbeatIfIdle()
    })
  }

  const handler = async (req: RouteRequest, res: RouteResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://dsh.local')
    if (url.pathname !== TASK_BOARD_LEDGER_PATH) {
      sendJson(res, 404, { ok: false, error: 'not found' })
      return
    }
    if (req.method === 'GET') {
      sendJson(res, 200, { ok: true, ledger: ledger.read() })
      return
    }
    if (req.method !== 'PUT') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    // Require an explicit JSON content-type: cross-site simple requests cannot
    // set it, so a form-based CSRF cannot rewrite the board.
    const contentType = req.headers['content-type'] ?? ''
    if (!(typeof contentType === 'string' && contentType.toLowerCase().startsWith('application/json'))) {
      sendJson(res, 415, { ok: false, error: 'application/json required' })
      return
    }
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      sendJson(res, 400, { ok: false, error: 'body must be an object' })
      return
    }
    const record = body as Record<string, unknown>
    const expectedRevision = typeof record.expectedRevision === 'number' && Number.isFinite(record.expectedRevision)
      ? Math.floor(record.expectedRevision)
      : undefined
    const decoded = decodeSubmittedTasks(record.tasks)
    if (!decoded.ok) {
      sendJson(res, 400, { ok: false, error: decoded.error })
      return
    }
    const commit = ledger.commit(decoded.tasks, expectedRevision)
    if (commit.ok) {
      broadcast(commit.ledger)
      sendJson(res, 200, { ok: true, ledger: commit.ledger })
      return
    }
    if (commit.conflict) {
      // The stream also announces the newer revision, in case the writer
      // window missed the broadcast that caused the conflict.
      broadcast(commit.ledger)
      sendJson(res, 409, { ok: false, conflict: true, ledger: commit.ledger })
      return
    }
    sendJson(res, 400, { ok: false, error: commit.error })
  }

  const disposers = [
    webServer.register({ kind: 'prefix', path: TASK_BOARD_ROUTE_PREFIX, handler }),
    webServer.register({
      kind: 'exact',
      path: TASK_BOARD_EVENTS_PATH,
      handler: (req, res) => { openStream(req, res) },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
    if (heartbeat !== undefined) clearInterval(heartbeat)
    heartbeat = undefined
    for (const subscriber of subscribers) subscriber.end()
    subscribers.clear()
  }
}
