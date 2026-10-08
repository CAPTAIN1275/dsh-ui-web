/**
 * dsh-full-stats —— 思考状态行的自定义文本（locale 层替换）。
 *
 * 官方 `dsh-client-ui-chat` 的 `RunningStatus` 直接用 locale 服务渲染这一行：
 *
 *   t("chat.deepDiving")                          // 尚无起始时间时的纯标签
 *   t("chat.deepDivingFor", { duration })         // 「标签 + 实时用时」，同一插值串
 *
 * 这两个 key 由 `chat` 命名空间字典提供（其 `NS = "chat"`），而 locale 服务的
 * `register()` 对 (namespace, locale) 是**单一所有者**：重复注册直接抛错
 * （`locale namespace "chat" already has locale "zh"`），所以插件无法用公开的
 * 注册 API 覆盖单键；`installLocale()` 也是 boot-once（重复安装抛错）。
 *
 * 可行的插入点在字典查询之外：`LocaleRuntime.bind(ns)` 返回的翻译函数体是
 * `(key, params) => this.translate(ns, key, params)`，`this.translate` 在调用时
 * 动态解析，因此把实例上的 `translate` 换成只处理 `chat` 命名空间两个 key 的
 * 包装函数，官方组件下一次渲染拿到的就是替换后的文本。
 *
 * 这与「改 DOM 文本」的本质区别：文本仍由 React 自己渲染，写入方只有 React
 * 一个，不存在第二个写入者被下一次重渲染覆盖的问题，因此不会闪烁；官方每秒
 * `setNow(Date.now())` 的重渲染照常发生，实时用时由官方模板原样保留。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'

/** 官方 chat 命名空间（`dsh-client-ui-chat` 的 `NS` 常量）。 */
export const CHAT_NS = 'chat'

/** 无起始时间时的纯标签 key。 */
export const THINKING_LABEL_KEY = 'chat.deepDiving'

/** 「标签 + 用时」插值串的 key（标签与时长在同一个模板里）。 */
export const THINKING_DURATION_KEY = 'chat.deepDivingFor'

/** 替换所需的最小 locale 运行时表面（`translate` 是官方实例方法名）。 */
export interface LocaleRuntimeLike {
  translate(ns: string, key: string, params?: Record<string, unknown>): string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * 浏览器 locale 注册表（由 `@deepseek-ai/dsh-client-locale` 提供）。
     * 这里只声明本包实际依赖的 `translate`；该包不是本包的依赖，
     * 与文件顶部对 slots 的处理同例 —— 只为类型席位，不引入运行时耦合。
     */
    locale: LocaleRuntimeLike
  }
}

/**
 * 计算替换后的文本；返回 `undefined` 表示「保持官方文本」。
 *
 * 只替换标签前缀，其余部分（含 `{duration}` 已渲染出的实时用时与分隔符）
 * 原样保留，因此计时继续走秒，各语言模板的排版也不被破坏。
 *
 * @param input.key - 被翻译的 key
 * @param input.official - 该 key 官方翻译出的完整文本
 * @param input.officialLabel - `chat.deepDiving` 官方翻译出的纯标签
 * @param input.configured - 用户配置；空串表示不替换
 * @returns 替换后的文本，或 `undefined`（不替换 / 不是可替换的 key）
 */
export function rewriteThinkingText(input: {
  key: string
  official: string
  officialLabel: string
  configured: string
}): string | undefined {
  const { key, official, officialLabel, configured } = input
  if (configured === '') return undefined
  if (key === THINKING_LABEL_KEY) return configured
  if (key !== THINKING_DURATION_KEY) return undefined
  // 官方模板以纯标签开头（zh「深度求索中，用时 …」/ en "Deep diving for …"）；
  // 拿不到该前缀时退化为纯自定义文本，绝不把两段标签拼在一起。
  return officialLabel !== '' && official.startsWith(officialLabel)
    ? configured + official.slice(officialLabel.length)
    : configured
}

/**
 * 在 locale 运行时实例上装入单键替换，返回幂等卸载函数。
 *
 * 包装函数只拦截 `chat` 命名空间的两个 key，其余（`common` 兜底查询、参数
 * 插值、回退链、其它命名空间）全部交给原始 `translate`，且包装内部直接调用
 * 原始函数，不会递归回自己。
 *
 * @param locale - 客户端 locale 运行时（`ctx.locale`）
 * @param configured - 读取当前配置文本；空串表示还原官方文案
 * @returns 卸载函数：恢复原始 `translate`
 */
export function installThinkingTextOverride(
  locale: LocaleRuntimeLike,
  configured: () => string,
): () => void {
  const hadOwnTranslate = Object.prototype.hasOwnProperty.call(locale, 'translate')
  const original = locale.translate

  const patched = function (
    this: unknown,
    ns: string,
    key: string,
    params?: Record<string, unknown>,
  ): string {
    const value = original.call(locale, ns, key, params)
    if (ns !== CHAT_NS) return value
    const custom = configured()
    if (custom === '') return value
    const replaced = rewriteThinkingText({
      key,
      official: value,
      officialLabel: key === THINKING_DURATION_KEY ? original.call(locale, ns, THINKING_LABEL_KEY) : '',
      configured: custom,
    })
    return replaced ?? value
  }

  locale.translate = patched as LocaleRuntimeLike['translate']

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    // 只撤销自己装上的那一层：期间若被别处改写就不再覆盖。
    if (locale.translate !== (patched as LocaleRuntimeLike['translate'])) return
    if (hadOwnTranslate) locale.translate = original
    else delete (locale as Partial<LocaleRuntimeLike>).translate
  }
}

/**
 * 把替换挂到客户端上下文的 locale 服务上（服务缺失时静默跳过，不影响统计行）。
 *
 * @param ctx - 客户端 cordis 上下文
 * @param configured - 读取当前配置文本
 */
export function mountThinkingTextOverride(
  ctx: ClientContext,
  configured: () => string,
): void {
  ctx.inject(['locale'], (scope) => {
    scope.effect(
      () => installThinkingTextOverride(scope.locale, configured),
      'ui-full-stats: thinking text locale override',
    )
  })
}
