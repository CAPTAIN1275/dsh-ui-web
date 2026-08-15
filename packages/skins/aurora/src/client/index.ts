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
import css from './aurora.module.css'

/** 需要的客户端服务：connection（模型目录读写）、sessions（当前会话）。 */
export const inject: string[] = ['connection', 'sessions']

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
        'radial-gradient(800px 700px at 60% 115%, rgba(160,80,255,0.15), transparent 60%)',
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
  body.dataset.dshAurora = ''

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

  const refresh = (): void => {
    void fetchConfig().then((cfg) => renderBackdrop(cfg))
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
