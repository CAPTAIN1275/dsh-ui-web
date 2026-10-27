/**
 * The /api/dsh-bot route family: health of the QQ bot stack and start/stop
 * control for it.
 *
 * Scope is deliberately narrow. AstrBot already ships its own WebUI for
 * models, personas, plugins and schedules, so this plugin only covers the
 * part that has no home: whether the three processes are alive, and turning
 * them on or off.
 *
 * It never touches the dsh process itself. Only AstrBot, NapCat and the hdc
 * device link are managed, all through D:\QQBot\botctl.ps1.
 */

import { execFile } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

const SCRIPT = 'D:\\QQBot\\botctl.ps1'
const POWERSHELL = 'powershell.exe'
const ALLOWED_ACTIONS = new Set(['status', 'start', 'stop', 'restart', 'rebuild'])

function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  return host.startsWith('127.0.0.1:') || host.startsWith('localhost:')
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** Run one botctl action and resolve with its stdout. */
function runBotctl(action: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, action],
      { timeout: timeoutMs, windowsHide: true, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error !== null && (stdout ?? '') === '') {
          reject(new Error(`${error.message}${stderr ? `: ${stderr}` : ''}`))
          return
        }
        resolve(stdout ?? '')
      },
    )
  })
}

/** Turn the script's "OK / DOWN" status lines into structured rows. */
function parseStatus(text: string): Array<{ label: string; ok: boolean; detail: string }> {
  const rows: Array<{ label: string; ok: boolean; detail: string }> = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const ok = trimmed.startsWith('OK')
    const down = trimmed.startsWith('DOWN')
    if (!ok && !down) continue
    const rest = trimmed.replace(/^(OK|DOWN)\s*/, '')
    const match = /^(.*?)\s{2,}(.*)$/.exec(rest)
    rows.push({
      label: (match?.[1] ?? rest).trim(),
      ok,
      detail: (match?.[2] ?? '').trim(),
    })
  }
  return rows
}

const routes: WebRoute[] = [
  {
    kind: 'exact',
    path: '/api/dsh-bot/status',
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      try {
        const out = await runBotctl('status', 30_000)
        writeJson(res, 200, { ok: true, rows: parseStatus(out), raw: out })
      } catch (error) {
        writeJson(res, 502, { ok: false, error: (error as Error).message })
      }
    },
  },
  {
    kind: 'exact',
    path: '/api/dsh-bot/action',
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      if ((req.method ?? 'GET') !== 'POST') {
        writeJson(res, 405, { error: 'use POST' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const action = (url.searchParams.get('action') ?? '').toLowerCase()
      if (!ALLOWED_ACTIONS.has(action)) {
        writeJson(res, 400, { error: `unknown action: ${action}` })
        return
      }
      try {
        const out = await runBotctl(action)
        writeJson(res, 200, { ok: true, action, output: out })
      } catch (error) {
        writeJson(res, 502, { ok: false, error: (error as Error).message })
      }
    },
  },
]

/**
 * Mount the route family.
 * @param ctx - host plugin context carrying webServer.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-bot-panel: routes')
}

export const inject = ['webServer']
export const name = 'dsh-bot-panel'
