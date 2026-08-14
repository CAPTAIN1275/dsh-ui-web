/**
 * Windows XP (Luna) skin — a hot-pluggable client plugin in the dsh web ui
 * family. apply() owns the whole window-chrome surface and retracts it on
 * dispose (the ThemePresenter retraction discipline: the plugin only ever
 * removes what it wrote): the `data-dsh-xp` body attribute the stylesheet is
 * scoped on, the fixed title/status bars, the sidebar Start button, the
 * injected favicon, and the document title the shell's DocumentTitle will
 * capture as the product title. The CSS rides the bundle's CSS-modules
 * auto-inject (style tag owned by the loader, removed on entry dispose).
 * No services are injected: the skin needs only the DOM.
 */
import type { Context } from '@deepseek-ai/cordis'
import css from './xp.module.css'

/** The product title the skin pins (captured by the shell's DocumentTitle after settle). */
const SKIN_TITLE = 'Windows XP · DeepSeek 在线'

/** Title bar caption buttons (decorative glyphs, aria-hidden). */
const TITLEBAR_GLYPHS = ['–', '□', '×'] as const

/** Status bar cells; the key cells are the classic CAPS/NUM/SCRL indicators. */
const STATUS_CELLS: ReadonlyArray<{ text: string; key: boolean }> = [
  { text: '就绪', key: false },
  { text: 'DeepSeek 在线', key: false },
  { text: '大写', key: true },
  { text: '数字', key: true },
  { text: '滚动', key: true },
]

/**
 * Resolve one module class name. The css-modules record types as
 * `string | undefined` under noUncheckedIndexedAccess; every key used here
 * is a literal name in this package's own stylesheet, so the fallback is
 * unreachable in practice and only satisfies the indexed-access type.
 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The classic four-color Windows flag, inline so the skin carries no static assets. */
const FLAG_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">',
  '<rect x="0.5" y="0.5" width="15" height="15" fill="#f0f6fd"/>',
  '<rect x="1.5" y="1.5" width="6.5" height="6.5" fill="#e33e2b"/>',
  '<rect x="8" y="1.5" width="6.5" height="6.5" fill="#4baf4d"/>',
  '<rect x="1.5" y="8" width="6.5" height="6.5" fill="#2d6fd6"/>',
  '<rect x="8" y="8" width="6.5" height="6.5" fill="#f4b400"/>',
  '</svg>',
].join('')

/** Four-color-flag favicon, inline data URI. */
const FAVICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
  '<rect x="2" y="2" width="60" height="60" fill="#f0f6fd"/>',
  '<rect x="7" y="7" width="25" height="25" fill="#e33e2b"/>',
  '<rect x="32" y="7" width="25" height="25" fill="#4baf4d"/>',
  '<rect x="7" y="32" width="25" height="25" fill="#2d6fd6"/>',
  '<rect x="32" y="32" width="25" height="25" fill="#f4b400"/>',
  '</svg>',
].join('')

/** The sidebar footer strip the Start button lives in (ui-sidebar footArea). */
const SIDEBAR_FOOT_SELECTOR = "[data-pane='sidebar'] > div > :last-child"

/**
 * Apply the Windows XP skin: body attribute, chrome bars, Start button,
 * title, favicon. All writes are retracted by the effect disposer on
 * dispose.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: Context): void {
  const body = document.body
  const originalTitle = document.title
  body.dataset.dshXp = ''

  const titlebar = document.createElement('div')
  titlebar.className = cls('xpTitlebar')
  titlebar.dataset.skinChrome = 'titlebar'
  const icon = document.createElement('span')
  icon.className = cls('xpTitlebarIcon')
  icon.innerHTML = FLAG_SVG
  const title = document.createElement('span')
  title.className = cls('xpTitlebarTitle')
  title.textContent = SKIN_TITLE
  titlebar.append(icon, title)
  for (const glyph of TITLEBAR_GLYPHS) {
    const btn = document.createElement('span')
    btn.className = cls(glyph === '×' ? 'xpTitlebarBtnClose' : 'xpTitlebarBtn')
    btn.setAttribute('aria-hidden', 'true')
    btn.textContent = glyph
    titlebar.append(btn)
  }

  const statusbar = document.createElement('div')
  statusbar.className = cls('xpStatusbar')
  statusbar.dataset.skinChrome = 'statusbar'
  const spacer = document.createElement('span')
  spacer.className = cls('xpStatusbarSpacer')
  statusbar.append(spacer)
  for (const cell of STATUS_CELLS) {
    const el = document.createElement('span')
    el.className = cls(cell.key ? 'xpStatusbarKey' : 'xpStatusbarCell')
    el.textContent = cell.text
    statusbar.append(el)
  }

  // The Start button opens the settings dialog by forwarding to the real
  // settings trigger in the sidebar footer strip. The footer may mount after
  // the skin settles (and re-render), and the settings dialog portals into
  // the sidebar column (making :last-child point at the portal), so install
  // is anchored on the trigger button and re-runs on DOM changes until
  // dispose.
  const mountStart = (): (() => void) => {
    const install = (): void => {
      const foot = document.querySelector(SIDEBAR_FOOT_SELECTOR)
      // The real footer strip carries the settings trigger; the dialog
      // portal (also a possible :last-child) never does.
      if (!foot?.querySelector('button[aria-haspopup="dialog"]')) return
      if (!foot.querySelector('[class*="xpStart"]')) {
        const start = document.createElement('button')
        start.type = 'button'
        start.className = cls('xpStart')
        const startIcon = document.createElement('span')
        startIcon.className = cls('xpStartIcon')
        startIcon.innerHTML = FLAG_SVG
        start.append(startIcon, document.createTextNode('开始'))
        const settings = foot.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
        start.addEventListener('click', () => settings?.click())
        foot.insertBefore(start, foot.firstChild)
      }
      // Anchor the taskbar styling on the real footer strip: a :last-child
      // anchor would leak the white footer-button color into every dialog
      // control.
      foot.classList.add(cls('xpTaskbar'))
    }
    const observer = new MutationObserver(install)
    observer.observe(document.body, { childList: true, subtree: true })
    install()
    return () => {
      observer.disconnect()
      const start = document.querySelector("[data-pane='sidebar'] [class*='xpStart']")
      start?.parentElement?.classList.remove(cls('xpTaskbar'))
      start?.remove()
    }
  }

  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = `data:image/svg+xml;utf8,${encodeURIComponent(FAVICON_SVG)}`
  document.head.append(favicon)

  document.title = SKIN_TITLE
  body.append(titlebar, statusbar)
  const disposeStart = mountStart()

  ctx.effect(() => () => {
    delete body.dataset.dshXp
    titlebar.remove()
    statusbar.remove()
    disposeStart()
    favicon.remove()
    // Only restore when the skin's own title still stands — a session title
    // projected by the shell must not be clobbered by skin teardown.
    if (document.title === SKIN_TITLE) document.title = originalTitle
  }, 'ui-skin-xp: window chrome')
}
