/**
 * Tonghuashun-style stock-trading skin — a hot-pluggable client plugin in the
 * dsh web ui family. apply() owns the whole terminal surface and retracts it
 * on dispose (the ThemePresenter retraction discipline: the plugin only ever
 * removes what it wrote): the `data-dsh-ths` body attribute the stylesheet is
 * scoped on, the fixed title/status bars, the injected favicon, and the
 * document title the shell's DocumentTitle will capture as the product title.
 * The CSS rides the bundle's CSS-modules auto-inject (style tag owned by the
 * loader, removed on entry dispose). No services are injected: the skin needs
 * only the DOM.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import css from './ths.module.css'

/** The product title the skin pins (captured by the shell's DocumentTitle after settle). */
const SKIN_TITLE = '同花顺 · DeepSeek 在线'

/** Refresh cadence of the code-workload index cell. */
const CODE_INDEX_REFRESH_MS = 30_000

/** Quote trend direction, coloring the status bar cells 红涨绿跌. */
type Trend = 'up' | 'down' | 'brand' | 'none'

/** Status bar cells; the spacer cell splits the quote group from the status group. */
const STOCK_CELLS: ReadonlyArray<{ text: string; trend: Trend }> = [
  { text: '同花顺', trend: 'brand' },
  { text: '上证指数 3,342.17 ▲0.42%', trend: 'up' },
  { text: '深证成指 10,846.59 ▲0.87%', trend: 'up' },
  { text: '创业板指 2,201.33 ▼0.21%', trend: 'down' },
  { text: '就绪', trend: 'none' },
  { text: '已连接', trend: 'none' },
  { text: '在线', trend: 'none' },
]

/** Title bar window buttons (decorative glyphs, aria-hidden). */
const TITLEBAR_GLYPHS = ['–', '□', '×'] as const

/** Live-quote chip shown in the title bar before the window buttons. */
const TICKER = { name: '上证指数', value: '3,342.17', change: '▲0.42%', trend: 'up' as const }

/**
 * Resolve one module class name. The css-modules record types as
 * `string | undefined` under noUncheckedIndexedAccess; every key used here
 * is a literal name in this package's own stylesheet, so the fallback is
 * unreachable in practice and only satisfies the indexed-access type.
 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

/** White candlestick mark, inline so the skin carries no static assets. */
const CANDLE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">',
  '<rect x="6" y="14" width="8" height="20" fill="#fff"/>',
  '<rect x="9" y="6" width="2" height="36" fill="#fff"/>',
  '<rect x="17" y="20" width="8" height="18" fill="#fff"/>',
  '<rect x="20" y="12" width="2" height="34" fill="#fff"/>',
  '<rect x="28" y="10" width="8" height="16" fill="#fff"/>',
  '<rect x="31" y="4" width="2" height="28" fill="#fff"/>',
  '</svg>',
].join('')

/** Brand-red square favicon carrying the 同 glyph, inline data URI. */
const FAVICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
  '<rect x="2" y="2" width="60" height="60" rx="12" fill="#e60012"/>',
  '<text x="32" y="45" font-size="36" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#fff" text-anchor="middle">同</text>',
  '</svg>',
].join('')

/**
 * Apply the stock-trading skin: body attribute, chrome bars, title, favicon.
 * All writes are retracted by the effect disposer on dispose.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: Context): void {
  const body = document.body
  const originalTitle = document.title
  body.dataset.dshThs = ''

  const titlebar = document.createElement('div')
  titlebar.className = cls('thsTitlebar')
  titlebar.dataset.skinChrome = 'titlebar'
  const icon = document.createElement('span')
  icon.className = cls('thsTitlebarIcon')
  icon.innerHTML = CANDLE_SVG
  const title = document.createElement('span')
  title.className = cls('thsTitlebarTitle')
  title.textContent = SKIN_TITLE
  titlebar.append(icon, title)
  const ticker = document.createElement('span')
  ticker.className = cls('thsTitlebarTicker')
  const tickerName = document.createElement('span')
  tickerName.textContent = TICKER.name
  const tickerValue = document.createElement('span')
  tickerValue.className = cls('thsTitlebarTickerVal')
  tickerValue.textContent = TICKER.value
  const tickerChange = document.createElement('span')
  tickerChange.className = cls('thsTitlebarTickerChg')
  tickerChange.dataset.trend = TICKER.trend
  tickerChange.textContent = TICKER.change
  ticker.append(tickerName, tickerValue, tickerChange)
  titlebar.append(ticker)
  for (const glyph of TITLEBAR_GLYPHS) {
    const btn = document.createElement('span')
    btn.className = cls('thsTitlebarBtn')
    btn.setAttribute('aria-hidden', 'true')
    btn.textContent = glyph
    titlebar.append(btn)
  }

  const statusbar = document.createElement('div')
  statusbar.className = cls('thsStatusbar')
  statusbar.dataset.skinChrome = 'statusbar'
  const spacer = document.createElement('span')
  spacer.className = cls('thsStatusbarSpacer')
  statusbar.append(spacer)
  for (const cell of STOCK_CELLS) {
    const el = document.createElement('span')
    el.className = cls('thsStatusbarCell')
    el.textContent = cell.text
    if (cell.trend !== 'none') el.dataset.trend = cell.trend
    statusbar.append(el)
  }

  // Code-workload index cell: the aggregate today net line change across all
  // workspaces (the "大盘" of the code-K-line idiom). Rendered between the
  // quote group and the status group; live data rides the codeKline RPC when
  // the connection handle is available, otherwise the cell shows a flat dash.
  const codeIndexCell = document.createElement('span')
  codeIndexCell.className = cls('thsStatusbarCell')
  codeIndexCell.textContent = '代码指数 --'
  statusbar.append(codeIndexCell)

  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.href = `data:image/svg+xml;utf8,${encodeURIComponent(FAVICON_SVG)}`
  document.head.append(favicon)

  document.title = SKIN_TITLE
  body.append(titlebar, statusbar)

  // Refresh the code-workload index every CODE_INDEX_REFRESH_MS. The skin
  // only reads: no events, no writes beyond its own cell. Failures degrade
  // to the dash — the stock chrome must never crash the terminal.
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  const api = connection?.api
  const refreshCodeIndex = (): void => {
    if (api === undefined) return
    void (async () => {
      try {
        const list = await api.workspace.list({})
        if (!list.result.ok) return
        let net = 0
        for (const workspace of list.result.value.items) {
          const response = await api.codeKline.list({ workspaceId: workspace.workspaceId, days: 1 })
          if (!response.result.ok) continue
          const candles = response.result.value.candles
          const last = candles[candles.length - 1]
          if (last === undefined) continue
          net += last.close - last.open
        }
        const trend: Trend = net > 0 ? 'up' : net < 0 ? 'down' : 'none'
        codeIndexCell.textContent = `代码指数 ${net > 0 ? '+' : ''}${net} 行`
        if (trend !== 'none') codeIndexCell.dataset.trend = trend
        else delete codeIndexCell.dataset.trend
      } catch {
        codeIndexCell.textContent = '代码指数 --'
      }
    })()
  }
  refreshCodeIndex()
  const refreshTimer = setInterval(refreshCodeIndex, CODE_INDEX_REFRESH_MS)

  ctx.effect(() => () => {
    clearInterval(refreshTimer)
    delete body.dataset.dshThs
    titlebar.remove()
    statusbar.remove()
    favicon.remove()
    // Only restore when the skin's own title still stands — a session title
    // projected by the shell must not be clobbered by skin teardown.
    if (document.title === SKIN_TITLE) document.title = originalTitle
  }, 'ui-skin-ths: quote chrome')
}
