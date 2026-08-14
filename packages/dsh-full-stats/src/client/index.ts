/**
 * dsh-full-stats —— 浏览器半区。
 *
 * 覆盖官方「会话统计行」（conversation.composer.dock 的 id=stats，本包以同 id
 * 更低 priority 顶替）：
 *  - 不省略：整行可换行展示（官方是 white-space:nowrap + ellipsis 截断）；
 *  - 加运行状态：行首状态点，会话运行中为琥珀色、空闲为绿色；
 *  - 自定义状态文本：WebUI 插件管理卡片配置「工作中/完成时」文本（经宿主
 *    /api/full-stats/config 持久化），配置后按状态显示对应文字；
 *  - 数据与官方同源：sessionStats 投影（轮/步/耗时/首 token/速度）+ tokenUsage
 *    投影（缓存命中/输入输出 token）。
 */
import { createElement, memo } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { FullStatsSettingsCard, FULL_STATS_EVENT, type FullStatsConfig } from './FullStatsSettingsCard.tsx'

/** 需要的客户端服务：插槽（覆盖注册 + 配置卡片）。 */
export const inject = ['slots']

/** 插槽与覆盖目标 id（官方 StatsLine 的注册 id）。 */
const DOCK = 'conversation.composer.dock'
const STATS_ID = 'stats'
const PLUGIN_ITEM = 'web-ui.plugin.item'

/** tokenUsage 投影值结构（本地声明）。 */
interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** sessionStats 投影值结构（本地声明，仅取展示所需字段）。 */
interface SessionStatsProjection {
  turns: number
  steps: number
  llmMs: number
  toolMs: number
  ttftMs: number
  ttftSteps: number
  decodeMs: number
  decodeTokens: number
}

const EMPTY_CONFIG: FullStatsConfig = { workingText: '', doneText: '' }
let cachedConfig: FullStatsConfig = { ...EMPTY_CONFIG }

/** 从宿主路由拉取配置（失败沿用缓存）。 */
async function refreshConfig(): Promise<void> {
  try {
    const res = await fetch('/api/full-stats/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<FullStatsConfig> }
    if (data?.ok === true && data.config !== undefined) {
      cachedConfig = {
        workingText: typeof data.config.workingText === 'string' ? data.config.workingText : '',
        doneText: typeof data.config.doneText === 'string' ? data.config.doneText : '',
      }
    }
  } catch {
    /* 沿用缓存 */
  }
}

function formatDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${Math.round(s * 10) / 10}s`
  const whole = Math.round(s)
  return `${Math.floor(whole / 60)}m${whole % 60}s`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatTokensPerSecond(rate: number): string {
  if (!Number.isFinite(rate)) return '0'
  return rate < 100 ? String(Math.round(rate * 10) / 10) : String(Math.round(rate))
}

function billedInputTokens(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

function cacheHitPercent(usage: TokenUsageProjection): number | null {
  const denominator = billedInputTokens(usage)
  return denominator === 0 ? null : Math.round((usage.cacheReadTokens / denominator) * 100)
}

/** 完整统计行组件（会话级插槽组件，框架注入 useSession/useProjection）。 */
const FullStatsLine = memo(function FullStatsLine(props: {
  useSession: <S>(selector: (s: { running: boolean; blank?: boolean }) => S) => S
  useProjection: <K extends string>(key: K) => unknown
}) {
  const { useSession, useProjection } = props
  const session = useSession((s) => ({ running: s.running, blank: s.blank === true }))
  const usage = useProjection('tokenUsage') as TokenUsageProjection | undefined
  const stats = useProjection('sessionStats') as SessionStatsProjection | undefined

  const groups: string[] = []
  if (stats !== undefined && stats.steps > 0) {
    groups.push(`${stats.turns} 轮 · ${stats.steps} 步`)
    const durations: string[] = []
    if (stats.llmMs > 0) durations.push(`LLM ${formatDuration(stats.llmMs)}`)
    if (stats.toolMs > 0) durations.push(`工具调用 ${formatDuration(stats.toolMs)}`)
    if (durations.length > 0) groups.push(durations.join(' · '))
    const speeds: string[] = []
    if (stats.ttftSteps > 0) speeds.push(`首 token 平均 ${formatDuration(stats.ttftMs / stats.ttftSteps)}`)
    if (stats.decodeMs > 0) {
      speeds.push(`${formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3))} tok/s`)
    }
    if (speeds.length > 0) groups.push(speeds.join(' · '))
  }
  if (usage !== undefined && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
    const cacheHit = cacheHitPercent(usage)
    if (cacheHit !== null) groups.push(`缓存命中 ${cacheHit}%`)
    groups.push(`输入 ${formatTokens(billedInputTokens(usage))} tok · 输出 ${formatTokens(usage.outputTokens)} tok`)
  }
  const statsLine = groups.join(' | ')

  // 自定义状态文本 + 详细统计同时显示：文本前置，统计不省略。
  if (session.running && cachedConfig.workingText !== '') {
    return renderLine(true, statsLine === '' ? cachedConfig.workingText : `${cachedConfig.workingText} | ${statsLine}`)
  }
  if (!session.running && !session.blank && cachedConfig.doneText !== '') {
    return renderLine(false, statsLine === '' ? cachedConfig.doneText : `${cachedConfig.doneText} | ${statsLine}`)
  }
  if (statsLine === '' && !session.running) return null
  return renderLine(session.running, statsLine)
})

/** 渲染一行：状态点 + 文本。 */
function renderLine(running: boolean, text: string) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 12px 6px',
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-tertiary, #888)',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'none',
        whiteSpace: 'normal',
        overflow: 'visible',
      },
    },
    createElement('span', {
      'aria-hidden': true,
      title: running ? '会话运行中' : '会话空闲',
      style: {
        flex: 'none',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: running ? '#f59e0b' : '#4ade80',
        boxShadow: running ? '0 0 6px rgba(245,158,11,0.8)' : 'none',
        transition: 'background 0.15s, box-shadow 0.15s',
      },
    }),
    createElement('span', { style: { whiteSpace: 'normal', overflow: 'visible' } }, text),
  )
}

/** 浏览器插件体：覆盖官方统计行 + 注册 WebUI 配置卡片。 */
export function apply(ctx: ClientContext): void {
  void refreshConfig()
  const onConfig = (): void => { void refreshConfig() }
  window.addEventListener(FULL_STATS_EVENT, onConfig)
  ctx.effect(() => () => window.removeEventListener(FULL_STATS_EVENT, onConfig), 'ui-full-stats: config listener')

  ctx.slots.inject(DOCK, () => ctx.slots.register(
    {
      name: DOCK,
      id: STATS_ID,
      order: 0,
      priority: -1,
    },
    FullStatsLine as never,
  ))

  // WebUI 插件组配置卡片（与任务看板/皮肤中心同级）。
  ctx.slots.inject(PLUGIN_ITEM, () => ctx.slots.register(
    {
      name: PLUGIN_ITEM,
      id: 'full-stats',
      order: 120,
    },
    FullStatsSettingsCard as never,
  ))
}
