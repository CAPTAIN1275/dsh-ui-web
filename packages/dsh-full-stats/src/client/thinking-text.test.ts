/**
 * dsh-full-stats —— 思考中文本替换的单元测试。
 *
 * 这里的 FakeLocaleRuntime 刻意照抄 `@deepseek-ai/dsh-client-locale` 里
 * `LocaleRuntime` 的两处关键行为：
 *   - `translate` 是原型方法（实例上可被自有属性遮蔽）；
 *   - `bind(ns)` 返回 `(key, params) => this.translate(ns, key, params)`，
 *     `this.translate` 在调用时解析 —— 这正是替换能在绑定之后仍然生效的原因。
 */
import { describe, expect, it } from 'vitest'
import {
  CHAT_NS,
  THINKING_DURATION_KEY,
  THINKING_LABEL_KEY,
  installThinkingTextOverride,
  rewriteThinkingText,
  type LocaleRuntimeLike,
} from './thinking-text.ts'

/** 官方 locale 运行时的最小复刻（原型方法 + 动态 this.translate）。 */
class FakeLocaleRuntime implements LocaleRuntimeLike {
  private readonly dicts = new Map<string, Record<string, string>>()
  private readonly bound = new Map<string, (key: string, params?: Record<string, unknown>) => string>()

  register(ns: string, locale: string, dict: Record<string, string>): void {
    for (const [key, value] of Object.entries(dict)) {
      const table = this.dicts.get(`${ns}/${locale}`) ?? {}
      table[key] = value
      this.dicts.set(`${ns}/${locale}`, table)
    }
  }

  bind(ns: string): (key: string, params?: Record<string, unknown>) => string {
    let t = this.bound.get(ns)
    if (t === undefined) {
      t = (key, params) => this.translate(ns, key, params)
      this.bound.set(ns, t)
    }
    return t
  }

  translate(ns: string, key: string, params?: Record<string, unknown>): string {
    const table = this.dicts.get(`${ns}/zh`) ?? {}
    const template = table[key] ?? key
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match)
  }
}

/** 建一个装了官方 chat 字典的运行时。 */
function officialRuntime(): { locale: FakeLocaleRuntime; t: (key: string, params?: Record<string, unknown>) => string } {
  const locale = new FakeLocaleRuntime()
  locale.register(CHAT_NS, 'zh', {
    [THINKING_LABEL_KEY]: '深度求索中',
    [THINKING_DURATION_KEY]: '深度求索中，用时 {duration} ···',
    'chat.toBottom': '回到下侧',
  })
  locale.register('common', 'zh', { cancel: '取消' })
  return { locale, t: locale.bind(CHAT_NS) }
}

describe('rewriteThinkingText', () => {
  const base = { officialLabel: '深度求索中', configured: '深海潜行中' }

  it('leaves the official copy alone when nothing is configured', () => {
    expect(rewriteThinkingText({ ...base, key: THINKING_LABEL_KEY, official: '深度求索中', configured: '' }))
      .toBeUndefined()
    expect(rewriteThinkingText({ ...base, key: THINKING_DURATION_KEY, official: '深度求索中，用时 5秒 ···', configured: '' }))
      .toBeUndefined()
  })

  it('replaces the plain label key outright', () => {
    expect(rewriteThinkingText({ ...base, key: THINKING_LABEL_KEY, official: '深度求索中' }))
      .toBe('深海潜行中')
  })

  it('keeps the live duration tail of the interpolated template', () => {
    expect(rewriteThinkingText({ ...base, key: THINKING_DURATION_KEY, official: '深度求索中，用时 5秒 ···' }))
      .toBe('深海潜行中，用时 5秒 ···')
    expect(rewriteThinkingText({ ...base, key: THINKING_DURATION_KEY, official: '深度求索中，用时 1分20秒 ···' }))
      .toBe('深海潜行中，用时 1分20秒 ···')
  })

  it('works for the English template too', () => {
    expect(rewriteThinkingText({
      key: THINKING_DURATION_KEY,
      official: 'Deep diving for 5s ···',
      officialLabel: 'Deep diving',
      configured: 'Deep sleeping',
    })).toBe('Deep sleeping for 5s ···')
  })

  it('degrades to the configured text when the label is not a prefix', () => {
    expect(rewriteThinkingText({
      key: THINKING_DURATION_KEY,
      official: 'totally different',
      officialLabel: '深度求索中',
      configured: '深海潜行中',
    })).toBe('深海潜行中')
  })

  it('never touches other keys', () => {
    expect(rewriteThinkingText({ ...base, key: 'chat.toBottom', official: '回到下侧' })).toBeUndefined()
  })
})

describe('installThinkingTextOverride', () => {
  it('rewrites the two chat keys and nothing else, keeping the duration', () => {
    const { locale, t } = officialRuntime()
    const uninstall = installThinkingTextOverride(locale, () => '深海潜行中')
    expect(t(THINKING_LABEL_KEY)).toBe('深海潜行中')
    expect(t(THINKING_DURATION_KEY, { duration: '5秒' })).toBe('深海潜行中，用时 5秒 ···')
    expect(t('chat.toBottom')).toBe('回到下侧')
    expect(locale.bind('common')('cancel')).toBe('取消')
    uninstall()
  })

  it('intercepts a translate function bound before the override was installed', () => {
    // 真实顺序：ui-chat 在 boot 时就 bind 了自己的 t，本插件可能在之后才挂载。
    const { locale, t } = officialRuntime()
    expect(t(THINKING_LABEL_KEY)).toBe('深度求索中')
    const uninstall = installThinkingTextOverride(locale, () => '深海潜行中')
    expect(t(THINKING_DURATION_KEY, { duration: '9秒' })).toBe('深海潜行中，用时 9秒 ···')
    uninstall()
  })

  it('restores the official copy after uninstall and leaves no own property behind', () => {
    const { locale, t } = officialRuntime()
    expect(Object.prototype.hasOwnProperty.call(locale, 'translate')).toBe(false)
    const uninstall = installThinkingTextOverride(locale, () => '深海潜行中')
    expect(Object.prototype.hasOwnProperty.call(locale, 'translate')).toBe(true)
    uninstall()
    expect(Object.prototype.hasOwnProperty.call(locale, 'translate')).toBe(false)
    expect(t(THINKING_LABEL_KEY)).toBe('深度求索中')
    expect(t(THINKING_DURATION_KEY, { duration: '5秒' })).toBe('深度求索中，用时 5秒 ···')
  })

  it('follows the configured value live and reverts when it is cleared', () => {
    const { locale, t } = officialRuntime()
    let configured = '甲'
    const uninstall = installThinkingTextOverride(locale, () => configured)
    expect(t(THINKING_LABEL_KEY)).toBe('甲')
    configured = '乙'
    expect(t(THINKING_LABEL_KEY)).toBe('乙')
    configured = ''
    expect(t(THINKING_LABEL_KEY)).toBe('深度求索中')
    uninstall()
  })

  it('is idempotent on uninstall', () => {
    const { locale, t } = officialRuntime()
    const uninstall = installThinkingTextOverride(locale, () => '深海潜行中')
    uninstall()
    uninstall()
    expect(t(THINKING_LABEL_KEY)).toBe('深度求索中')
  })

  it('keeps working when translate is an own property rather than a prototype method', () => {
    const { locale, t } = officialRuntime()
    const proto = Object.getPrototypeOf(locale) as FakeLocaleRuntime
    const own = proto.translate.bind(locale)
    Object.defineProperty(locale, 'translate', { value: own, writable: true, configurable: true })
    const uninstall = installThinkingTextOverride(locale, () => '深海潜行中')
    expect(t(THINKING_LABEL_KEY)).toBe('深海潜行中')
    uninstall()
    expect(Object.prototype.hasOwnProperty.call(locale, 'translate')).toBe(true)
    expect(t(THINKING_LABEL_KEY)).toBe('深度求索中')
  })
})
