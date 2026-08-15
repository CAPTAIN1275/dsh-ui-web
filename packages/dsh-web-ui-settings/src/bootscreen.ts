/**
 * dsh-web-ui-settings 启动屏配置。
 * 持久化 `~/.dsh/bootscreen.json`：启动标题（默认 HARNESS）、启动提示（默认
 * Loading plugins...）、启动背景图 URL（可选）。client 端通过 MutationObserver
 * 替换启动屏 DOM + 注入样式。
 * @module @captain1275/dsh-client-ui-web-ui-settings/bootscreen
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** 启动屏配置形状。 */
export interface BootScreenConfig {
  /** 启动标题（替换 HARNESS）。 */
  title: string
  /** 启动提示（替换 Loading plugins...）。 */
  hint: string
  /** 启动背景图 URL（空 = 官方默认）。 */
  backgroundUrl: string
}

/** 官方默认值。 */
export const BOOTSCREEN_DEFAULTS: BootScreenConfig = { title: '', hint: '', backgroundUrl: '' }

/** 路由前缀。 */
export const BOOTSCREEN_API_PREFIX = '/api/bootscreen'

/** 配置文件路径：$DSH_HOME/bootscreen.json。 */
export function bootscreenPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'bootscreen.json')
}

/** 读取配置（文件缺失/损坏时回退默认）。 */
export function readBootscreen(): BootScreenConfig {
  try {
    const raw = JSON.parse(readFileSync(bootscreenPath(), 'utf8')) as Partial<BootScreenConfig>
    return {
      title: typeof raw.title === 'string' ? raw.title : BOOTSCREEN_DEFAULTS.title,
      hint: typeof raw.hint === 'string' ? raw.hint : BOOTSCREEN_DEFAULTS.hint,
      backgroundUrl: typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : BOOTSCREEN_DEFAULTS.backgroundUrl,
    }
  } catch {
    return { ...BOOTSCREEN_DEFAULTS }
  }
}

/** 规范化 PUT 载荷。 */
export function normalizeBootscreen(raw: Partial<BootScreenConfig>): BootScreenConfig {
  return {
    title: typeof raw.title === 'string' ? raw.title : BOOTSCREEN_DEFAULTS.title,
    hint: typeof raw.hint === 'string' ? raw.hint : BOOTSCREEN_DEFAULTS.hint,
    backgroundUrl: typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : BOOTSCREEN_DEFAULTS.backgroundUrl,
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (body.length > 1_000_000) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

/** 请求分发：GET/PUT /api/bootscreen/config。 */
export function handleBootscreen(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${BOOTSCREEN_API_PREFIX}/config` && req.method === 'GET') {
    sendJson(res, 200, { ok: true, config: readBootscreen() })
    return
  }
  if (url.pathname === `${BOOTSCREEN_API_PREFIX}/config` && req.method === 'PUT') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body) as Partial<BootScreenConfig>
        const next = normalizeBootscreen(parsed)
        writeFileSync(bootscreenPath(), JSON.stringify(next, null, 2), 'utf8')
        sendJson(res, 200, { ok: true, config: next })
      })
      .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}
