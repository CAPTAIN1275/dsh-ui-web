/**
 * QQ98 skin, upgraded to the QQ2008 era — the first skin in the dsh web ui
 * family, as a hot-pluggable client plugin. apply() owns the whole retro
 * surface and retracts it on dispose (the ThemePresenter retraction
 * discipline: the plugin only ever removes what it wrote): the
 * `data-dsh-retro` body attribute the stylesheet is scoped on, the fixed
 * title/status bars, the injected favicon, and the document title the
 * shell's DocumentTitle will capture as the product title. The CSS rides
 * the bundle's CSS-modules auto-inject (style tag owned by the loader,
 * removed on entry dispose). No services are injected: the skin needs only
 * the DOM.
 */
import type { Context } from '@deepseek-ai/cordis'
import css from './qq98.module.css'

/** The product title the skin pins (captured by the shell's DocumentTitle after settle). */
const SKIN_TITLE = 'QQ2008 · DeepSeek 在线'

/** Status bar cells; the spacer cell splits left and right groups. */
const STATUS_CELLS = ['QQ 2008', '就绪', '已连接', '在线', 'QQ2008 正式版'] as const

/** Title bar window buttons (decorative glyphs, aria-hidden). */
const TITLEBAR_GLYPHS = ['–', '□', '×'] as const

/**
 * Resolve one module class name. The css-modules record types as
 * `string | undefined` under noUncheckedIndexedAccess; every key used here
 * is a literal name in this package's own stylesheet, so the fallback is
 * unreachable in practice and only satisfies the indexed-access type.
 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

/** QQ2008-era penguin mark (scarfed, rounded), inline so the skin carries no static assets. */
const PENGUIN_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">',
  '<ellipse cx="24" cy="26" rx="16" ry="19" fill="#2e3440"/>',
  '<ellipse cx="24" cy="30" rx="10" ry="13" fill="#f2f4f7"/>',
  '<ellipse cx="24" cy="12" rx="12" ry="11" fill="#2e3440"/>',
  '<ellipse cx="24" cy="14" rx="8" ry="6.5" fill="#f2f4f7"/>',
  '<circle cx="20" cy="12" r="2.2" fill="#fff"/><circle cx="20" cy="12" r="1.1" fill="#10141c"/>',
  '<circle cx="28" cy="12" r="2.2" fill="#fff"/><circle cx="28" cy="12" r="1.1" fill="#10141c"/>',
  '<polygon points="24,14.8 21.8,17.2 24,18.8 26.2,17.2" fill="#ff8c1a"/>',
  '<ellipse cx="10.5" cy="26" rx="3.5" ry="9" fill="#2e3440" transform="rotate(12 10.5 26)"/>',
  '<ellipse cx="37.5" cy="26" rx="3.5" ry="9" fill="#2e3440" transform="rotate(-12 37.5 26)"/>',
  '<rect x="13" y="19" width="22" height="5.5" rx="2.5" fill="#ff7f27"/>',
  '<path d="M13.5 24 q-2.6 4.2 -1.2 8.5 q2.2 -1 3 -5.6 Z" fill="#ff7f27"/>',
  '<ellipse cx="19" cy="45" rx="5" ry="2.6" fill="#ff8c1a"/>',
  '<ellipse cx="29" cy="45" rx="5" ry="2.6" fill="#ff8c1a"/>',
  '</svg>',
].join('')

/**
 * Apply the QQ98 skin (QQ2008 edition): body attribute, chrome bars, title,
 * favicon. All writes are retracted by the effect disposer on dispose.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: Context): void {
  const body = document.body
  const originalTitle = document.title
  body.dataset.dshRetro = ''

  const titlebar = document.createElement('div')
  titlebar.className = cls('retroTitlebar')
  titlebar.dataset.skinChrome = 'titlebar'
  const icon = document.createElement('span')
  icon.className = cls('retroTitlebarIcon')
  icon.innerHTML = PENGUIN_SVG
  const title = document.createElement('span')
  title.className = cls('retroTitlebarTitle')
  title.textContent = SKIN_TITLE
  titlebar.append(icon, title)
  for (const glyph of TITLEBAR_GLYPHS) {
    const btn = document.createElement('span')
    btn.className = cls('retroTitlebarBtn')
    btn.setAttribute('aria-hidden', 'true')
    btn.textContent = glyph
    titlebar.append(btn)
  }

  const statusbar = document.createElement('div')
  statusbar.className = cls('retroStatusbar')
  statusbar.dataset.skinChrome = 'statusbar'
  const spacer = document.createElement('span')
  spacer.className = cls('retroStatusbarSpacer')
  statusbar.append(spacer)
  for (const cell of STATUS_CELLS) {
    const el = document.createElement('span')
    el.className = cls('retroStatusbarCell')
    el.textContent = cell
    statusbar.append(el)
  }

  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = `data:image/svg+xml;utf8,${encodeURIComponent(PENGUIN_SVG)}`
  document.head.append(favicon)

  document.title = SKIN_TITLE
  body.append(titlebar, statusbar)

  ctx.effect(() => () => {
    delete body.dataset.dshRetro
    titlebar.remove()
    statusbar.remove()
    favicon.remove()
    // Only restore when the skin's own title still stands — a session title
    // projected by the shell must not be clobbered by skin teardown.
    if (document.title === SKIN_TITLE) document.title = originalTitle
  }, 'ui-skin-qq98: QQ2008 chrome')
}
