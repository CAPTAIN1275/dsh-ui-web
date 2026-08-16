/**
 * aurora 皮肤 —— 浏览器半区。
 *
 * 与 dsh-web-ui 皮肤契约一致：apply() 只写自己能回收的东西，dispose 时全部还原。
 * 自定义背景配置通过宿主 `/api/skin-aurora/config` 路由读写（持久化到
 * `~/.dsh/skin-aurora.json`）；皮肤中心卡片的修改会派发 `dshc-aurora-config`
 * 窗口事件，本半区监听后重新拉取配置并重绘背景层。
 *
 * CSS 走 bundle 的 CSS-modules 自动注入；token 覆盖在 aurora.module.css 里以
 * body[data-dsh-aurora] 作用域声明。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { EffortPanel } from './effort/EffortPanel.tsx'
// 液态玻璃：aqua（DSH-Transparent-UI-Plugin）机制照搬（见 aqua/ 目录）。
// AquaLayer 挂 html 属性 + blur/frost 变量；玻璃调节（blur/frost）由
// 皮肤中心极光卡片提供（localStorage + AURORA_EVENT 驱动本层）。
import { AquaLayer } from './aqua/theme-layer.ts'
// aqua 玻璃样式表（side-effect 注入）。
import './aqua/aqua.module.css'
import css from './aurora.module.css'

/** 需要的客户端服务：connection/sessions（aurora 背景与 Effort）、theme（aqua 层）。 */
export const inject: string[] = ['connection', 'sessions', 'theme']

/** 配置变更事件（皮肤中心卡片写入后派发，本半区监听重绘）。 */
export const AURORA_EVENT = 'dshc-aurora-config'

interface AuroraConfig {
  enabled: boolean
  backgroundUrl: string
  opacity: number
  blur: number
  mediaType: 'image' | 'video'
  muted: boolean
}

const DEFAULTS: AuroraConfig = { enabled: true, backgroundUrl: '', opacity: 0.8, blur: 0, mediaType: 'image', muted: true }

let cached: AuroraConfig = { ...DEFAULTS }

/** 从宿主路由拉取最新配置（失败时沿用缓存）。 */
async function fetchConfig(): Promise<AuroraConfig> {
  try {
    const res = await fetch('/api/skin-aurora/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<AuroraConfig> }
    if (data?.ok === true && data.config !== undefined) {
      cached = {
        enabled: typeof data.config.enabled === 'boolean' ? data.config.enabled : DEFAULTS.enabled,
        backgroundUrl: typeof data.config.backgroundUrl === 'string' ? data.config.backgroundUrl : DEFAULTS.backgroundUrl,
        opacity: typeof data.config.opacity === 'number' ? data.config.opacity : DEFAULTS.opacity,
        blur: typeof data.config.blur === 'number' ? data.config.blur : DEFAULTS.blur,
        mediaType: data.config.mediaType === 'video' ? 'video' : 'image',
        muted: typeof data.config.muted === 'boolean' ? data.config.muted : DEFAULTS.muted,
      }
    }
  } catch {
    /* 沿用缓存 */
  }
  return cached
}

/** 解析一个模块类名（css-modules 记录按字面量名索引）。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

function cssEscape(url: string): string {
  return url.replace(/["\\]/g, '\\$&')
}

/** 深色极光渐变（深色模式默认背景）。 */
function auroraGradient(dark: boolean): string {
  return dark
    ? [
        'radial-gradient(1200px 800px at 15% 8%, rgba(90,120,255,0.38), transparent 60%)',
        'radial-gradient(1000px 700px at 85% 18%, rgba(0,200,180,0.24), transparent 55%)',
        'linear-gradient(180deg, #05081a 0%, #0c1234 55%, #111736 100%)',
      ].join(',')
    : [
        'radial-gradient(1200px 800px at 15% 8%, rgba(90,130,255,0.30), transparent 60%)',
        'radial-gradient(1000px 700px at 85% 18%, rgba(0,180,170,0.20), transparent 55%)',
        'radial-gradient(900px 900px at 60% 100%, rgba(150,90,255,0.22), transparent 60%)',
        'linear-gradient(180deg, #f2f5ff 0%, #e4ebfb 55%, #ece7fb 100%)',
      ].join(',')
}

/**
 * 应用 aurora 皮肤：body 属性 + 自定义背景层（配置驱动，经路由读取、事件联动）。
 * 所有写入由 ctx.effect 的 disposer 在卸载时回收。
 * @param ctx - 宿主上下文（effect 生命周期负责回收）。
 */
export function apply(ctx: ClientContext): void {
  const body = document.body
  // token 配色（body 作用域，官方基础 token 定义在 body 上）。
  body.dataset.dshAurora = ''

  // 液态玻璃层（aqua 机制照搬）：先挂载（ambient 背景层先入 DOM），
  // aurora 的自定义背景层随后挂载，保证用户背景盖在 aqua 的 ambient 之上。
  const glass = new AquaLayer(ctx)
  glass.setEnabled(true)

  // 侧边栏背景模糊层：sidebarCol 不加 backdrop-filter（会捕获设置弹窗），
  // 用 body 子级的独立 fixed 层（z-index 0，低于侧边栏 9）模糊侧边栏背后的
  // 背景幕；弹窗 z-index 高、不在该层 DOM 内，不会被捕获。
  // 模糊层精确匹配悬浮卡片区域（位置/大小/圆角），不会在卡片外露出直角层。
  const sidebarBlur = document.createElement('div')
  sidebarBlur.dataset.auroraSidebarBlur = ''
  sidebarBlur.style.cssText = 'position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 0; pointer-events: none;'
  body.appendChild(sidebarBlur)
  let blurObserver: ResizeObserver | null = null
  const syncSidebarBlur = (): void => {
    const col = document.querySelector<HTMLElement>('[class*="sidebarCol"]')
    if (col === null) return
    const rect = col.getBoundingClientRect()
    sidebarBlur.style.left = `${rect.left}px`
    sidebarBlur.style.top = `${rect.top}px`
    sidebarBlur.style.width = `${rect.width}px`
    sidebarBlur.style.height = `${rect.height}px`
    sidebarBlur.style.borderRadius = '20px'
  }
  // apply 早于官方 shell 渲染 sidebarCol：等它出现再同步宽度 + 挂 ResizeObserver。
  const sidebarWaitObserver = new MutationObserver(() => {
    syncSidebarBlur()
    if (blurObserver === null && typeof ResizeObserver !== 'undefined') {
      const col = document.querySelector<HTMLElement>('[class*="sidebarCol"]')
      if (col !== null) {
        blurObserver = new ResizeObserver(syncSidebarBlur)
        blurObserver.observe(col)
      }
    }
  })

  // 侧边栏收起/展开动画（JS 驱动）：CSS transition 在 React 重建节点时
  // 有概率不触发——用 Web Animations API 直接对 sidebarCol 做 margin 动画
  // （真实收缩/展开 + overshoot 弹性曲线），稳定触发。
  // 折叠状态持久化：存 localStorage，刷新后自动恢复。
  // 恢复时提前隐藏侧边栏列，避免"刷新先展开、加载好才收起"的闪烁。
  const SIDEBAR_COLLAPSED_KEY = 'dsh.ui-skin-aurora.sidebar-collapsed'
  let restorePending = false
  let restoreHideStyle: HTMLStyleElement | null = null
  try {
    restorePending = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch { /* ignore */ }
  if (restorePending) {
    restoreHideStyle = document.createElement('style')
    restoreHideStyle.textContent = '[data-dsh-frame] [class*="sidebarCol"] { visibility: hidden; }'
    document.head.appendChild(restoreHideStyle)
  }
  let sidebarCollapseObserver: MutationObserver | null = null
  const bounceSidebar = (): void => {
    const col = document.querySelector<HTMLElement>('[class*="sidebarCol"]')
    const frame = document.querySelector<HTMLElement>('[data-dsh-frame]')
    if (frame === null) return
    const collapsed = frame.hasAttribute('data-sidebar-collapsed')
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false')
    } catch { /* localStorage 不可用则仅本次生效 */ }
    // 恢复完成：已处于折叠态，移除隐藏、跳过动画。
    if (restorePending && collapsed) {
      restorePending = false
      restoreHideStyle?.remove()
      restoreHideStyle = null
      return
    }
    if (col === null || typeof col.animate !== 'function') return
    // JS 弹性兜底：scaleX 轻微弹跳（合成器动画，React 重建节点也可见）。
    // 收缩/展开的主动画由 CSS margin/padding transition 提供。
    col.animate(
      [
        { transform: 'scaleX(1)' },
        { transform: collapsed ? 'scaleX(0.97)' : 'scaleX(1.03)' },
        { transform: 'scaleX(1)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }
  // 刷新后恢复折叠状态：读 localStorage，若存了折叠且当前未折叠则点官方折叠按钮。
  const restoreSidebarCollapsed = (): void => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true') return
      const frame = document.querySelector<HTMLElement>('[data-dsh-frame]')
      if (frame !== null && !frame.hasAttribute('data-sidebar-collapsed')) {
        const toggle = document.querySelector<HTMLElement>('[class*="toggle"]')
        toggle?.click()
      }
    } catch { /* ignore */ }
  }
  const observeFrameCollapse = (): void => {
    if (sidebarCollapseObserver !== null) return
    const frame = document.querySelector<HTMLElement>('[data-dsh-frame]')
    if (frame === null) return
    sidebarCollapseObserver = new MutationObserver(bounceSidebar)
    sidebarCollapseObserver.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed'] })
    // frame 出现后尽早恢复持久化的折叠状态（等官方初始渲染完成）。
    window.setTimeout(restoreSidebarCollapsed, 150)
  }
  // 等 frame 出现再挂监听。
  const collapseWaitObserver = new MutationObserver(observeFrameCollapse)
  collapseWaitObserver.observe(body, { childList: true, subtree: true })
  observeFrameCollapse()
  sidebarWaitObserver.observe(body, { childList: true, subtree: true })
  syncSidebarBlur()

  let backdrop: HTMLElement | null = null
  let videoEl: HTMLVideoElement | null = null
  let videoSrc = ''

  const renderBackdrop = (cfg: AuroraConfig): void => {
    // 配置变化时：若已是视频背景且 URL 未变，只更新样式（不重载视频，
    // 避免模糊/透明度调节导致重新缓冲卡顿）；否则重建背景层。
    if (backdrop !== null && backdrop.isConnected && cfg.enabled && cfg.backgroundUrl === videoSrc) {
      backdrop.style.opacity = String(cfg.opacity)
      backdrop.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : 'none'
      if (videoEl !== null && cfg.mediaType === 'video') {
        videoEl.muted = cfg.muted
      }
      return
    }
    backdrop?.remove()
    backdrop = null
    videoEl = null
    videoSrc = ''
    if (!cfg.enabled) return
    const dark = body.dataset.dsDarkTheme !== undefined
    const layer = document.createElement('div')
    layer.className = cls('auroraBackdrop')
    layer.style.opacity = String(cfg.opacity)
    layer.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : 'none'
    if (cfg.backgroundUrl && cfg.mediaType === 'video') {
      // 视频背景：<video> 铺底，autoplay/muted/loop/playsinline。
      // 永不显示 controls（避免进度条/控制条）；声音只由 muted 开关控制。
      const video = document.createElement('video')
      video.src = cfg.backgroundUrl
      video.autoplay = true
      video.muted = cfg.muted
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.className = cls('auroraVideo')
      layer.appendChild(video)
      videoEl = video
      videoSrc = cfg.backgroundUrl
    } else {
      // 图片/动图背景：background-image（GIF/WebP 动图原生支持）。
      layer.style.backgroundImage = cfg.backgroundUrl
        ? `url("${cssEscape(cfg.backgroundUrl)}")`
        : auroraGradient(dark)
    }
    body.appendChild(layer)
    backdrop = layer
  }

  /** 读 localStorage 玻璃值（皮肤中心极光卡片写入），应用到 AquaLayer。 */
  const syncGlass = (): void => {
    const readNum = (key: string, fallback: number): number => {
      try {
        const raw = localStorage.getItem(key)
        const n = raw === null ? Number.NaN : Number(raw)
        return Number.isFinite(n) ? n : fallback
      } catch {
        return fallback
      }
    }
    glass.setBlur(readNum('dsh.ui-skin-aurora.blur', 14))
    glass.setFrost(readNum('dsh.ui-skin-aurora.frost', 50))
  }

  const refresh = (): void => {
    void fetchConfig().then((cfg) => renderBackdrop(cfg))
    syncGlass()
  }

  // 皮肤中心卡片写入后联动重绘。
  const onConfig = (): void => refresh()
  window.addEventListener(AURORA_EVENT, onConfig)

  // 深浅主题切换时重画背景（极光渐变分浅/深两套）。
  const observer = new MutationObserver(refresh)
  observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  refresh()

  // Effort 推理等级：点击官方模型菜单里的「推理等级」行时，拦截官方级别
  // 列表，改为弹出 aurora 滑块面板（只写 reasoningEffort，不动模型选择）。
  const host = document.createElement('div')
  host.dataset.auroraEffortHost = ''
  host.style.cssText = 'position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;'
  body.appendChild(host)
  let root: Root | null = null

  const hidePanel = (): void => {
    root?.unmount()
    root = null
  }
  const showPanel = (sessionId: string, anchor: HTMLElement): void => {
    const rect = anchor.getBoundingClientRect()
    // 面板 280 宽、约 150 高；视口内定位，下方不够时弹到锚点上方。
    const PANEL_W = 280
    const PANEL_H = 150
    const left = Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8))
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= PANEL_H + 16
      ? rect.bottom + 8
      : Math.max(8, rect.top - PANEL_H - 8)
    host.style.left = `${left}px`
    host.style.top = `${top}px`
    if (root === null) root = createRoot(host)
    root.render(createElement(EffortPanel, {
      sessionId,
      connection: ctx.get('connection') as ConnectionHandle,
      onClose: hidePanel,
    }))
  }

  const onDocClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    // 面板内部交互不处理。
    if (host.contains(target)) return
    const row = target.closest?.('button[role="menuitem"]')
    if (row instanceof HTMLElement) {
      const text = (row.textContent ?? '').trim()
      // 官方 root 菜单的第二行：label「推理等级」/「Effort」。
      if (text.startsWith('推理等级') || text.startsWith('Effort')) {
        console.log('[aurora-effort] intercept row:', JSON.stringify(text))
        event.preventDefault()
        event.stopPropagation()
        const current = (ctx.get('sessions') as { list: { getSnapshot(): { current?: string } } }).list.getSnapshot().current
        console.log('[aurora-effort] session:', current)
        if (current !== undefined) showPanel(current, row)
        else console.warn('[aurora-effort] no session id')
        return
      }
    }
    if (!host.contains(target)) hidePanel()
  }
  document.addEventListener('click', onDocClick, true)

  ctx.effect(
    () => () => {
      delete body.dataset.dshAurora
      sidebarWaitObserver.disconnect()
      collapseWaitObserver.disconnect()
      sidebarCollapseObserver?.disconnect()
      blurObserver?.disconnect()
      sidebarBlur.remove()
      observer.disconnect()
      window.removeEventListener(AURORA_EVENT, onConfig)
      document.removeEventListener('click', onDocClick, true)
      hidePanel()
      host.remove()
      backdrop?.remove()
      backdrop = null
    },
    'ui-skin-aurora: backdrop + effort panel',
  )
}
