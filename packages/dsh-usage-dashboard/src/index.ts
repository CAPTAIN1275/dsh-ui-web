/**
 * dsh-usage-dashboard 宿主半区。
 * 注册 `/api/usage/*` 路由：client 端把每次响应的 token 用量上报（POST
 * /api/usage/record），看板读取聚合数据（GET /api/usage/summary）。
 * 持久化到 `~/.dsh/usage.json`（与 aurora/pet/full-stats 同模式，绕开
 * /api 设置桥命名空间白名单）。
 * @module @captain1275/dsh-usage-dashboard
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { estimateCost } from './cost.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-usage-dashboard'

/** 路由前缀。 */
export const USAGE_API_PREFIX = '/api/usage'

/** 一天内的毫秒数。 */
const DAY_MS = 24 * 60 * 60 * 1000

/** 单次记录（client 上报的一次响应 token 用量增量）。 */
export interface UsageRecord {
  /** 会话 id（client 侧唯一标识）。 */
  sessionId: string
  /** 会话标题（便于看板识别）。 */
  sessionTitle: string
  /** 模型标识（provider/model）。 */
  model: string
  /** 时间戳（ms）。 */
  ts: number
  /** 输入 token（含缓存读取）。 */
  inputTokens: number
  /** 输出 token。 */
  outputTokens: number
  /** 缓存命中 token。 */
  cacheReadTokens: number
}

/** 持久化聚合数据。 */
export interface UsageStore {
  /** 按会话聚合。 */
  bySession: Record<string, {
    title: string
    lastModel: string
    lastTs: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    calls: number
  }>
  /** 按天聚合（YYYY-MM-DD）。 */
  byDay: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    calls: number
  }>
  /** 按模型聚合。 */
  byModel: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    calls: number
  }>
  /** 全量累计。 */
  total: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    calls: number
  }
}

/** 空聚合。 */
export function emptyUsage(): UsageStore {
  return { bySession: {}, byDay: {}, byModel: {}, total: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0 } }
}

/** 配置文件路径：$DSH_HOME/usage.json。 */
export function usagePath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'usage.json')
}

/** 日期键（本地时区）。 */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 读取聚合数据（缺失/损坏时回退空）。 */
export function readUsage(): UsageStore {
  try {
    const raw = JSON.parse(readFileSync(usagePath(), 'utf8')) as Partial<UsageStore>
    if (typeof raw !== 'object' || raw === null) return emptyUsage()
    return {
      bySession: raw.bySession ?? {},
      byDay: raw.byDay ?? {},
      byModel: raw.byModel ?? {},
      total: raw.total ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0 },
    }
  } catch {
    return emptyUsage()
  }
}

/** 写入聚合数据（失败静默，不影响主流程）。 */
export function writeUsage(store: UsageStore): void {
  try {
    writeFileSync(usagePath(), JSON.stringify(store, null, 2), 'utf8')
  } catch {
    /* 持久化失败不阻断上报 */
  }
}

/** 把一条记录并入聚合（replace 语义：同会话以最新快照覆盖，避免双计）。 */
export function applyRecord(store: UsageStore, record: UsageRecord): void {
  const sessionId = record.sessionId || 'default'
  const existing = store.bySession[sessionId]

  // Session bucket holds the LATEST cumulative snapshot (client uploads the
  // current totals). Replace, never accumulate — the dashboard sums the
  // snapshots at read time, so repeated polls cannot double count.
  const prevInput = existing?.inputTokens ?? 0
  const prevOutput = existing?.outputTokens ?? 0
  const prevCache = existing?.cacheReadTokens ?? 0
  const session: UsageStore['bySession'][string] = {
    title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
    lastModel: record.model || existing?.lastModel || 'unknown',
    lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadTokens: record.cacheReadTokens,
    calls: (existing?.calls ?? 0) + 1,
  }
  store.bySession[sessionId] = session

  // Day / model buckets: running deltas relative to the previous snapshot.
  // The first upload for a session contributes its full snapshot; later
  // uploads contribute only the growth (clamped at zero so a projection
  // reset cannot subtract).
  const dInput = Math.max(0, record.inputTokens - prevInput)
  const dOutput = Math.max(0, record.outputTokens - prevOutput)
  const dCache = Math.max(0, record.cacheReadTokens - prevCache)
  if (dInput + dOutput + dCache <= 0) return

  const day = dayKey(record.ts)
  const dayBucket = store.byDay[day] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0 }
  dayBucket.inputTokens += dInput
  dayBucket.outputTokens += dOutput
  dayBucket.cacheReadTokens += dCache
  dayBucket.calls += 1
  store.byDay[day] = dayBucket

  const model = record.model || 'unknown'
  const modelBucket = store.byModel[model] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0 }
  modelBucket.inputTokens += dInput
  modelBucket.outputTokens += dOutput
  modelBucket.cacheReadTokens += dCache
  modelBucket.calls += 1
  store.byModel[model] = modelBucket

  store.total.inputTokens += dInput
  store.total.outputTokens += dOutput
  store.total.cacheReadTokens += dCache
  store.total.calls += 1
}

/** 最近 N 天的按天序列（缺失日补零，便于画图）。 */
export function recentDays(store: UsageStore, days: number): Array<{ day: string; inputTokens: number; outputTokens: number; calls: number }> {
  const out: Array<{ day: string; inputTokens: number; outputTokens: number; calls: number }> = []
  const now = Date.now()
  for (let offset = days - 1; offset >= 0; offset--) {
    const ts = now - offset * DAY_MS
    const key = dayKey(ts)
    const bucket = store.byDay[key]
    out.push({
      day: key,
      inputTokens: bucket?.inputTokens ?? 0,
      outputTokens: bucket?.outputTokens ?? 0,
      calls: bucket?.calls ?? 0,
    })
  }
  return out
}

/** 会话排行（按总 token 降序）。 */
export function sessionRanking(store: UsageStore, limit: number): Array<{
  id: string
  title: string
  model: string
  lastTs: number
  totalTokens: number
  calls: number
}> {
  return Object.entries(store.bySession)
    .map(([id, s]) => ({
      id,
      title: s.title,
      model: s.lastModel,
      lastTs: s.lastTs,
      totalTokens: s.inputTokens + s.outputTokens + s.cacheReadTokens,
      calls: s.calls,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit)
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

/** 规范化上报载荷。 */
function normalizeRecord(raw: Partial<UsageRecord>): UsageRecord | undefined {
  const inputTokens = typeof raw.inputTokens === 'number' && Number.isFinite(raw.inputTokens) ? Math.max(0, Math.round(raw.inputTokens)) : 0
  const outputTokens = typeof raw.outputTokens === 'number' && Number.isFinite(raw.outputTokens) ? Math.max(0, Math.round(raw.outputTokens)) : 0
  const cacheReadTokens = typeof raw.cacheReadTokens === 'number' && Number.isFinite(raw.cacheReadTokens) ? Math.max(0, Math.round(raw.cacheReadTokens)) : 0
  if (inputTokens + outputTokens + cacheReadTokens <= 0) return undefined
  return {
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : 'default',
    sessionTitle: typeof raw.sessionTitle === 'string' ? raw.sessionTitle : '',
    model: typeof raw.model === 'string' ? raw.model : 'unknown',
    ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
    inputTokens,
    outputTokens,
    cacheReadTokens,
  }
}

/** 请求分发：POST /api/usage/record, GET /api/usage/summary。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${USAGE_API_PREFIX}/record` && req.method === 'POST') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body) as Partial<UsageRecord>
        const record = normalizeRecord(parsed)
        if (record === undefined) {
          sendJson(res, 200, { ok: true, skipped: true })
          return
        }
        const store = readUsage()
        applyRecord(store, record)
        writeUsage(store)
        sendJson(res, 200, { ok: true, skipped: false })
      })
      .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return
  }
  if (url.pathname === `${USAGE_API_PREFIX}/summary` && req.method === 'GET') {
    const store = readUsage()
    const modelCosts = Object.fromEntries(
      Object.entries(store.byModel).map(([model, b]) => [
        model,
        estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens),
      ]),
    )
    const totalCost = Object.values(modelCosts).reduce((a, b) => a + b, 0)
    const sessions = sessionRanking(store, 20).map((s) => ({
      ...s,
      cost: estimateCost(s.model, store.bySession[s.id]?.inputTokens ?? 0, store.bySession[s.id]?.outputTokens ?? 0, store.bySession[s.id]?.cacheReadTokens ?? 0),
    }))
    sendJson(res, 200, {
      ok: true,
      total: store.total,
      byModel: store.byModel,
      recent: recentDays(store, 14),
      sessions,
      byDayCount: Object.keys(store.byDay).length,
      cost: {
        total: Math.round(totalCost * 100) / 100,
        byModel: modelCosts,
      },
    })
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (httpCtx) => {
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: USAGE_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'ui-usage-dashboard: usage route')
  })
}
