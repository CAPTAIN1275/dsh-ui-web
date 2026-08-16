/**
 * dsh-web-ui compat shim, browser half (folded into the aggregate package).
 *
 * The current dsh web shell renders its grid columns without the legacy
 * `data-pane` / `data-dsh-frame` hooks (the columns carry css-module class
 * names such as `*_sidebarCol` / `*_centerCol` / `*_detailsCol`). The
 * dsh-web-ui family plugins (task-board, ssh, aionui-panel, several skins)
 * mount at the DOM level through those legacy selectors, so without them the
 * plugins stay silent even though they load.
 *
 * This shim stamps the expected attributes onto the real shell elements and
 * re-applies them on any DOM mutation (React re-renders that re-create the
 * columns), which restores every DOM-mounting plugin and the skins' column
 * selectors in one place. It only ever WRITES attributes; it never removes
 * nodes and never disturbs React's reconciliation.
 */
import type { Context } from '@deepseek-ai/cordis'

/** Column shims: element selector → attribute to stamp. */
const COLUMN_SHIMS: ReadonlyArray<readonly [selector: string, attribute: string]> = [
  ['[class*="sidebarCol"]', 'data-pane="sidebar"'],
  ['[class*="centerCol"]', 'data-pane="conversation"'],
  ['[class*="detailsCol"]', 'data-pane="details"'],
]

/** Stamp one attribute of the form `name="value"` onto an element, if found. */
function stamp(el: Element | null, attribute: string): void {
  if (el === null) return
  const eq = attribute.indexOf('=')
  const name = attribute.slice(0, eq)
  const value = attribute.slice(eq + 1).replace(/^"|"$/g, '')
  el.setAttribute(name, value)
}

/** One pass over the current DOM. */
function applyShims(): void {
  for (const [selector, attribute] of COLUMN_SHIMS) {
    stamp(document.querySelector(selector), attribute)
  }
  // The frame is the grid item that parents the sidebar column.
  stamp(document.querySelector('[class*="sidebarCol"]')?.parentElement ?? null, 'data-dsh-frame=""')
}

/**
 * crypto.randomUUID polyfill：部分手机浏览器（旧版 WebView / 国产浏览器）
 * 没有 crypto.randomUUID，官方模型目录等加载会直接崩
 * （"crypto.randomUUID is not a function"）。页面加载早期补一个 UUID v4。
 */
function polyfillRandomUUID(): void {
  try {
    const c = globalThis.crypto as { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array }
    if (c !== undefined && typeof c.randomUUID === 'function') return
    const uuid = (): string => {
      const bytes = new Uint8Array(16)
      if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes)
      else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
      bytes[6] = (bytes[6]! & 0x0f) | 0x40
      bytes[8] = (bytes[8]! & 0x3f) | 0x80
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
    }
    if (c !== undefined) c.randomUUID = uuid
  } catch { /* crypto 不可用时跳过（浏览器自身会报错） */ }
}

/** Required services: none — the shim must run before any DOM mount waits. */
export const inject = [] as const

/**
 * Register the shim for the page lifetime.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  polyfillRandomUUID()
  ctx.effect(() => {
    applyShims()
    // The shell renders after boot settlement and React can re-create the
    // columns on re-render; re-stamp on any DOM mutation. Idempotent: writes
    // only the same attribute values, so this never fights React.
    const observer = new MutationObserver(applyShims)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect() }
  })
}
