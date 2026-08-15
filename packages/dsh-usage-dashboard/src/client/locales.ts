/**
 * dsh-usage-dashboard locale copy (zh source of truth, en mirror).
 * @module @captain1275/dsh-usage-dashboard/client/locales
 */

export const NS = 'usage-dashboard' as const

export const zh = {
  'usage.entry': '用量',
  'usage.title': '用量看板',
  'usage.total': '累计用量',
  'usage.today': '今日',
  'usage.calls': '调用',
  'usage.input': '输入',
  'usage.output': '输出',
  'usage.cache': '缓存',
  'usage.trend': '近 14 天趋势',
  'usage.trendDetail': '每日 token 消耗（输入 + 输出 + 缓存）',
  'usage.sessions': '会话排行',
  'usage.models': '模型分布',
  'usage.tokens': 'token',
  'usage.close': '关闭用量看板',
  'usage.empty': '暂无用量数据',
  'usage.noData': '使用 DSH 对话后，这里会显示详细用量统计。',
  'usage.settingsTitle': '用量看板',
  'usage.settingsHint': '记录每次响应的 token 用量并展示彩色统计看板。',
}

export const en = {
  'usage.entry': 'Usage',
  'usage.title': 'Usage Dashboard',
  'usage.total': 'Total usage',
  'usage.today': 'Today',
  'usage.calls': 'calls',
  'usage.input': 'Input',
  'usage.output': 'Output',
  'usage.cache': 'Cache',
  'usage.trend': 'Last 14 days',
  'usage.trendDetail': 'Daily token usage (input + output + cache)',
  'usage.sessions': 'Top sessions',
  'usage.models': 'Model distribution',
  'usage.tokens': 'tokens',
  'usage.close': 'Close usage dashboard',
  'usage.empty': 'No usage data yet',
  'usage.noData': 'Start chatting with DSH and detailed usage stats will appear here.',
  'usage.settingsTitle': 'Usage dashboard',
  'usage.settingsHint': 'Records per-response token usage and renders a colorful stats dashboard.',
} satisfies Record<UsageDashboardKey, string>

/** The usage-dashboard dictionary key set, derived from the zh dictionary. */
export type UsageDashboardKey = keyof typeof zh

/** Translate helper bound to the usage namespace (component-local). */
export function t(key: UsageDashboardKey, params?: Record<string, string | number>): string {
  const lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? en : zh
  let text = lang[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}
