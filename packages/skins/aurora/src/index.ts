/**
 * aurora 皮肤 — 宿主半区。
 * 注册 `/api/skin-aurora/config` 路由（GET 读 / PUT 写），把自定义背景配置持久化到
 * `~/.dsh/skin-aurora.json`。皮肤中心卡片（浏览器半区）与 aurora 皮肤本身都通过
 * 该接口读写配置——绕开 /api 设置桥的命名空间白名单限制（dsh-host-apiproxy
 * 的 WEB_SETTINGS_NAMESPACES，与 pet 的 /api/pet/* 同模式）。
 * @module @captain1275/dsh-client-ui-skin-aurora
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-skin-aurora'

/** 配置形状。 */
export interface AuroraSkinConfig {
  enabled: boolean
  backgroundUrl: string
  opacity: number
  blur: number
}

const DEFAULTS: AuroraSkinConfig = { enabled: true, backgroundUrl: '', opacity: 0.8, blur: 0 }

/** 路由前缀（与皮肤中心卡片一致）。 */
export const AURORA_API_PREFIX = '/api/skin-aurora'

/** 配置文件路径：DSH_HOME/skin-aurora.json（与 pet.json 同模式）。 */
function configPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skin-aurora.json')
}

/** 读取配置（文件缺失或损坏时回退默认值）。 */
function readConfig(): AuroraSkinConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<AuroraSkinConfig>
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
      backgroundUrl: typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : DEFAULTS.backgroundUrl,
      opacity: typeof raw.opacity === 'number' ? raw.opacity : DEFAULTS.opacity,
      blur: typeof raw.blur === 'number' ? raw.blur : DEFAULTS.blur,
    }
  } catch {
    return { ...DEFAULTS }
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
      if (body.length > 2_000_000) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

/** 请求分发：GET/PUT /api/skin-aurora/config。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${AURORA_API_PREFIX}/config` && req.method === 'GET') {
    sendJson(res, 200, { ok: true, config: readConfig() })
    return
  }
  if (url.pathname === `${AURORA_API_PREFIX}/config` && req.method === 'PUT') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body) as Partial<AuroraSkinConfig>
        const next: AuroraSkinConfig = {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
          backgroundUrl: typeof parsed.backgroundUrl === 'string' ? parsed.backgroundUrl : DEFAULTS.backgroundUrl,
          opacity: typeof parsed.opacity === 'number' ? parsed.opacity : DEFAULTS.opacity,
          blur: typeof parsed.blur === 'number' ? parsed.blur : DEFAULTS.blur,
        }
        writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
        sendJson(res, 200, { ok: true, config: next })
      })
      .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (httpCtx) => {
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: AURORA_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'ui-skin-aurora: config route')
  })
}
