/**
 * /git/* route layer: JSON envelope (ok/error with stable codes) for the
 * query/mutation operations and an SSE stream for external branch changes.
 * The service itself owns workspace gating and the git guards; this layer
 * owns HTTP shape and the SSE subscriber bookkeeping.
 * @module dsh-git-graph/host/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { GitError } from '../core/types.ts'
import type { GitService } from './git-service.ts'

/** Envelope every /git JSON response carries. */
export type GitEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: GitError }

const OK = (value: unknown): GitEnvelope<unknown> => ({ ok: true, value })
const FAIL = (error: GitError): GitEnvelope<never> => ({ ok: false, error })

/** Git operation error for structurally invalid requests (never a workspace fault). */
const BAD_REQUEST: GitError = { code: 'internal', message: 'malformed request' }

/** One SSE subscriber: a workspace path and its last pushed state key. */
interface Subscriber {
  path: string
  last: string
  res: ServerResponse
}

/** Poll interval for external git-state changes while subscribers are connected. */
const POLL_INTERVAL_MS = 2_000
/** SSE keep-alive comment interval (proxies drop idle connections). */
const HEARTBEAT_INTERVAL_MS = 15_000

/** Request body size cap; larger bodies are destroyed rather than drained. */
const BODY_CAP_BYTES = 1 << 20

/** Read a JSON request body into an unknown value; null when unparseable. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const part = chunk as Buffer
    total += part.length
    if (total > BODY_CAP_BYTES) {
      // Stop reading (no drain) and tear the connection down; the oversized
      // body is never parsed.
      req.destroy()
      chunks.length = 0
      return null
    }
    chunks.push(part)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Extract the required string field from a JSON object payload. */
function pathOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const path = (payload as Record<string, unknown>).path
  return typeof path === 'string' && path !== '' ? path : null
}

/** Write one JSON envelope response. */
function json(res: ServerResponse, envelope: GitEnvelope<unknown>, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(envelope))
}

/**
 * Register the /git routes (prefix for the JSON operations, exact for the
 * SSE stream — longest-prefix-wins keeps them disjoint).
 * @param ctx - context carrying the webServer service.
 * @param service - the workspace-gated git service.
 * @returns the route disposers.
 */
export function registerGitRoutes(ctx: Context, service: GitService): () => void {
  const subscribers = new Set<Subscriber>()
  let pollTimer: NodeJS.Timeout | undefined
  let heartbeatTimer: NodeJS.Timeout | undefined

  const push = (subscriber: Subscriber, payload: unknown): void => {
    subscriber.res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  const poll = (): void => {
    for (const subscriber of subscribers) {
      void service.status(subscriber.path).then((status) => {
        const key = status === null ? 'no-repo' : `${status.root}|${status.branch}|${status.head}`
        if (key === subscriber.last) return
        subscriber.last = key
        push(subscriber, { path: subscriber.path, status })
      }).catch((error: unknown) => {
        ctx.logger.warn(`dsh-git-graph: status poll failed for ${subscriber.path}: ${String(error)}`)
      })
    }
  }

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }
    // CSRF hardening: the /git mutations (switch/create-branch) act on the
    // real repository with no origin/referer check, so require a JSON
    // content-type — cross-site forms cannot set application/json without a
    // CORS preflight, which the same-origin client always sends.
    const contentType = req.headers['content-type'] ?? ''
    if (!contentType.toLowerCase().startsWith('application/json')) {
      res.writeHead(415)
      res.end()
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    const payload = await readJsonBody(req)
    const path = pathOf(payload)
    if (path === null) {
      json(res, FAIL(BAD_REQUEST))
      return
    }
    switch (pathname) {
      case '/git/status':
        json(res, OK(await service.status(path)))
        return
      case '/git/branches':
        json(res, OK(await service.branches(path)))
        return
      case '/git/graph': {
        const rawLimit = typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>).limit
          : undefined
        const limit = typeof rawLimit === 'number' && rawLimit > 0 && rawLimit <= 1000 ? rawLimit : undefined
        json(res, OK(await service.graph(path, limit)))
        return
      }
      case '/git/switch': {
        const branch = typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>).branch
          : undefined
        if (typeof branch !== 'string' || branch === '') {
          json(res, FAIL(BAD_REQUEST))
          return
        }
        const result = await service.switchBranch(path, branch)
        json(res, result.ok ? OK({ branch: result.branch }) : FAIL(result.error))
        return
      }
      case '/git/create-branch': {
        const name = typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>).name
          : undefined
        if (typeof name !== 'string' || name === '') {
          json(res, FAIL(BAD_REQUEST))
          return
        }
        const result = await service.createBranch(path, name)
        json(res, result.ok ? OK({ branch: result.branch }) : FAIL(result.error))
        return
      }
      default:
        res.writeHead(404)
        res.end()
    }
  }

  const sse = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://x')
    const path = url.searchParams.get('path')
    if (path === null || path === '') {
      res.writeHead(400)
      res.end()
      return
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    res.write('retry: 2000\n\n')
    const subscriber: Subscriber = { path, last: '', res }
    subscribers.add(subscriber)
    if (pollTimer === undefined) {
      pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    }
    if (heartbeatTimer === undefined) {
      heartbeatTimer = setInterval(() => {
        for (const current of subscribers) current.res.write(': ping\n\n')
      }, HEARTBEAT_INTERVAL_MS)
    }
    req.on('close', () => {
      subscribers.delete(subscriber)
      if (subscribers.size === 0) {
        if (pollTimer !== undefined) clearInterval(pollTimer)
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
        pollTimer = undefined
        heartbeatTimer = undefined
      }
    })
  }

  const disposers = [
    ctx.webServer.register({ kind: 'prefix', path: '/git', handler }),
    ctx.webServer.register({ kind: 'exact', path: '/git/events', handler: sse }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
    if (pollTimer !== undefined) clearInterval(pollTimer)
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
    for (const subscriber of subscribers) subscriber.res.end()
    subscribers.clear()
  }
}
