/**
 * dsh-full-stats —— 宿主半区。
 *
 * 注册 `/api/full-stats/config` 路由（GET 读 / PUT 写），把自定义状态文本
 * （工作中/完成时）持久化到 `~/.dsh/full-stats.json`。浏览器半区的统计行与
 * WebUI 插件管理卡片都通过该接口读写 —— 与 aurora 皮肤、pet 同模式，绕开
 * /api 设置桥的命名空间白名单限制，移动端远程同样可用。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-full-stats'

/** 配置形状：思考中/工作中/完成时的自定义状态文本（空串 = 显示原始）。 */
export interface FullStatsConfig {
  thinkingText: string
  workingText: string
  doneText: string
}

const DEFAULTS: FullStatsConfig = { thinkingText: '', workingText: '', doneText: '' }

/** 路由前缀。 */
export const FULL_STATS_API_PREFIX = '/api/full-stats'

/** 配置文件路径：$DSH_HOME/full-stats.json。 */
function configPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'full-stats.json')
}

/** 读取配置（文件缺失/损坏时回退默认值）。 */
export function readConfig(): FullStatsConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<FullStatsConfig>
    return {
      thinkingText: typeof raw.thinkingText === 'string' ? raw.thinkingText : DEFAULTS.thinkingText,
      workingText: typeof raw.workingText === 'string' ? raw.workingText : DEFAULTS.workingText,
      doneText: typeof raw.doneText === 'string' ? raw.doneText : DEFAULTS.doneText,
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
      if (body.length > 100_000) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

/** 请求分发：GET/PUT /api/full-stats/config。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${FULL_STATS_API_PREFIX}/config` && req.method === 'GET') {
    sendJson(res, 200, { ok: true, config: readConfig() })
    return
  }
  if (url.pathname === `${FULL_STATS_API_PREFIX}/config` && req.method === 'PUT') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body) as Partial<FullStatsConfig>
        const next: FullStatsConfig = {
          thinkingText: typeof parsed.thinkingText === 'string' ? parsed.thinkingText : DEFAULTS.thinkingText,
          workingText: typeof parsed.workingText === 'string' ? parsed.workingText : DEFAULTS.workingText,
          doneText: typeof parsed.doneText === 'string' ? parsed.doneText : DEFAULTS.doneText,
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
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: FULL_STATS_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'ui-full-stats: config route')
  })
}
