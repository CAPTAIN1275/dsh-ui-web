/**
 * 启动屏自定义：替换官方 boot 卡（HARNESS / Loading plugins...）。
 *
 * 官方启动屏由 AppRoot 渲染（dsh-client-web），类名是编译后的 hash
 * （AppRoot.module.css 的 wordmark/hint/card），无法静态选择。这里用
 * 内容匹配定位：找到文本恰为官方占位（HARNESS / Loading plugins...）的
 * 元素原位替换；再注入 <style> 覆盖 boot 卡样式（背景图等）。配置为空时
 * 保持官方默认。
 * @module @captain1275/dsh-client-ui-web-ui-settings/client/bootscreen
 */

/** 官方默认启动标题。 */
const OFFICIAL_TITLE = 'HARNESS'
/** 官方默认启动提示。 */
const OFFICIAL_HINT = 'Loading plugins...'

/** 启动屏配置（与 host /api/bootscreen/config 一致）。 */
export interface BootScreenConfig {
  title: string
  hint: string
  backgroundUrl: string
}

/** 注入的样式标签 id（幂等）。 */
const STYLE_TAG_ID = 'dsh-bootscreen-style'

/** 从宿主拉取配置。 */
async function fetchConfig(): Promise<BootScreenConfig> {
  try {
    const res = await fetch('/api/bootscreen/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<BootScreenConfig> }
    if (data?.ok === true && data.config !== undefined) {
      return {
        title: typeof data.config.title === 'string' ? data.config.title : '',
        hint: typeof data.config.hint === 'string' ? data.config.hint : '',
        backgroundUrl: typeof data.config.backgroundUrl === 'string' ? data.config.backgroundUrl : '',
      }
    }
  } catch {
    /* 保持默认 */
  }
  return { title: '', hint: '', backgroundUrl: '' }
}

/** 查找并替换一个官方占位文本节点（返回是否替换）。 */
function replaceTextNode(root: ParentNode, official: string, replacement: string): boolean {
  let replaced = false
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.nextNode()
  while (node !== null) {
    if (node.textContent?.trim() === official) {
      node.textContent = replacement
      replaced = true
    }
    node = walker.nextNode()
  }
  return replaced
}

/** 注入启动屏样式覆盖（背景图等）。 */
function applyStyle(config: BootScreenConfig): void {
  const existing = document.getElementById(STYLE_TAG_ID)
  existing?.remove()
  if (config.backgroundUrl === '') return
  const style = document.createElement('style')
  style.id = STYLE_TAG_ID
  // boot 卡在 AppRoot.module.css 里是 .boot（全屏居中）下的 .card。用
  // 属性无关的选择器：匹配包含 HARNESS 文本的卡片容器太脆，改为覆盖
  // 常见 boot 布局（居中卡片 + 背景）。选择器用类名前缀尽可能宽松。
  style.textContent = [
    `[class*="boot"] {`,
    `  background: url("${config.backgroundUrl}") center / cover no-repeat !important;`,
    `}`,
  ].join('\n')
  document.head.appendChild(style)
}

/** 应用一次替换（立即 + 每次 DOM 变化）。 */
function applyOnce(config: BootScreenConfig): void {
  if (config.title !== '') replaceTextNode(document.body, OFFICIAL_TITLE, config.title)
  if (config.hint !== '') replaceTextNode(document.body, OFFICIAL_HINT, config.hint)
  applyStyle(config)
}

/**
 * 挂载启动屏替换器。MutationObserver 监听 body 变化——启动屏在插件加载
 * 期间/重载时会重新渲染，替换会随之生效。返回 disposer。
 * @returns 卸载函数。
 */
export async function mountBootScreenReplacer(): Promise<() => void> {
  const config = await fetchConfig()
  if (config.title === '' && config.hint === '' && config.backgroundUrl === '') {
    return () => {}
  }
  applyOnce(config)
  const observer = new MutationObserver(() => applyOnce(config))
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
