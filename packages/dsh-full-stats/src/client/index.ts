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
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the renderer-owned ctx.slots Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the conversation slot declarations (conversation.composer.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { FullStatsSettingsCard, FULL_STATS_EVENT, type FullStatsConfig } from './FullStatsSettingsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The child slot the Web UI plugin group section declares; this card
     * registers into the group rather than a top-level settings page. Spelled
     * here with the same shape so this package registers without depending on
     * the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

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

const EMPTY_CONFIG: FullStatsConfig = { thinkingText: '', workingText: '', doneText: '' }
let cachedConfig: FullStatsConfig = { ...EMPTY_CONFIG }

/** 从宿主路由拉取配置（失败沿用缓存）。 */
async function refreshConfig(): Promise<void> {
  try {
    const res = await fetch('/api/full-stats/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<FullStatsConfig> }
    if (data?.ok === true && data.config !== undefined) {
      cachedConfig = {
        thinkingText: typeof data.config.thinkingText === 'string' ? data.config.thinkingText : '',
        workingText: typeof data.config.workingText === 'string' ? data.config.workingText : '',
        doneText: typeof data.config.doneText === 'string' ? data.config.doneText : '',
      }
    }
  } catch {
    /* 沿用缓存 */
  }
}

/**
 * 替换思考状态行的标签文本，保留实时时长。配置为空时还原官方标签。
 *
 * 定位靠**稳定的 data 属性**：0.2.0 的 RunningStatus 渲染为
 * `<div data-chat-running><span role="status">纯本地化标签</span>…<span>标签+用时</span></div>`，
 * 没有 `turnStatus` 类（旧选择器因此在 0.2.0 上匹配不到任何东西），
 * 而 `role="status"` 那个视觉隐藏的 span 里正是**不带时长的本地化标签**
 * （中文「深度求索中」/ 英文 "Deep diving"）。
 *
 * 可见 span 里标签与时长是同一个插值字符串（"chat.deepDivingFor"），
 * 所以只替换标签前缀、把其后紧随的时长原样留下，并且每次 DOM 变动都重新推导，
 * 让计时继续走。
 */
function applyThinkingText(): void {
  const configured = cachedConfig.thinkingText
  document.querySelectorAll<HTMLElement>('[data-chat-running]').forEach((row) => {
    const official = (row.querySelector<HTMLElement>('[role="status"]')?.textContent ?? '').trim()
    // 可见标签所在的 span：排除视觉隐藏的标签 span 与分隔符。
    const visible = Array.from(row.querySelectorAll<HTMLElement>('span'))
      .filter((s) => s.getAttribute('role') !== 'status' && (s.textContent ?? '').trim() !== '')
      .pop()
    if (visible === undefined) return
    const textNode = Array.from(visible.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
    )
    if (textNode === undefined) return

    const current = textNode.textContent ?? ''
    // 时长 = 当前文本去掉「官方标签」或「我们写过的标签」前缀后的剩余部分。
    let tail = ''
    if (official !== '' && current.startsWith(official)) tail = current.slice(official.length)
    else if (configured !== '' && current.startsWith(configured)) tail = current.slice(configured.length)
    const next = (configured === '' ? official : configured) + tail
    if (next !== current && next !== '') textNode.textContent = next
  })
}

function mountThinkingTextReplacer(): () => void {
  // 立即执行 + 监听 DOM 变化（会话切换/流式重渲染都会重建状态行）。
  applyThinkingText()
  const observer = new MutationObserver(applyThinkingText)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
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
  // Re-apply after the refresh settles: a config edit must reach a status line
  // that is already on screen, not only the next one the shell rebuilds.
  const onConfig = (): void => { void refreshConfig().then(applyThinkingText) }
  window.addEventListener(FULL_STATS_EVENT, onConfig)
  ctx.effect(() => () => window.removeEventListener(FULL_STATS_EVENT, onConfig), 'ui-full-stats: config listener')

  // Deep diving 替换：监听 turnStatus 状态行，把官方占位文本换成用户配置。
  ctx.effect(() => mountThinkingTextReplacer(), 'ui-full-stats: thinking text replacer')

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
