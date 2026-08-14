/**
 * Aurora custom-background section: rendered inside the aurora skin's card in
 * the skin center. Provides local image picking (auto-compressed to a data
 * URL), a URL input for web images, a clear button, and opacity/blur sliders.
 *
 * Persistence goes through the aurora skin's host route `/api/skin-aurora/config`
 * (stored at ~/.dsh/skin-aurora.json) — the /api settings bridge only exposes
 * the hardcoded WEB_SETTINGS_NAMESPACES allowlist, so this mirrors the pet's
 * `/api/pet/*` pattern instead. Every write dispatches `dshc-aurora-config` on
 * window; the aurora skin's browser half listens and repaints its backdrop.
 */
import { useEffect, useRef, useState } from 'react'
import css from './skin-center.module.css'

/** 配置形状（与 aurora 宿主一致）。 */
export interface AuroraCardConfig {
  enabled: boolean
  backgroundUrl: string
  opacity: number
  blur: number
}

const DEFAULTS: AuroraCardConfig = { enabled: true, backgroundUrl: '', opacity: 0.8, blur: 0 }

/** 配置变更事件（aurora 皮肤浏览器半区监听）。 */
const AURORA_EVENT = 'dshc-aurora-config'

/** 解析一个模块类名。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

async function fetchConfig(): Promise<AuroraCardConfig> {
  try {
    const res = await fetch('/api/skin-aurora/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<AuroraCardConfig> }
    if (data?.ok === true && data.config !== undefined) {
      return {
        enabled: typeof data.config.enabled === 'boolean' ? data.config.enabled : DEFAULTS.enabled,
        backgroundUrl: typeof data.config.backgroundUrl === 'string' ? data.config.backgroundUrl : DEFAULTS.backgroundUrl,
        opacity: typeof data.config.opacity === 'number' ? data.config.opacity : DEFAULTS.opacity,
        blur: typeof data.config.blur === 'number' ? data.config.blur : DEFAULTS.blur,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

async function writeConfig(next: AuroraCardConfig): Promise<boolean> {
  try {
    const res = await fetch('/api/skin-aurora/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
    const data = (await res.json()) as { ok?: boolean }
    return data?.ok === true
  } catch {
    return false
  }
}

/** 本地图片转压缩 data URL（最长边 1920px、JPEG 0.85）。 */
function fileToDataUrl(file: File, maxDim = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx === null) throw new Error('无法创建画布')
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取该图片'))
    }
    img.src = url
  })
}

/** Aurora 卡片内的自定义背景区块。 */
export function AuroraBackgroundSection() {
  const [cfg, setCfg] = useState<AuroraCardConfig>(DEFAULTS)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const isData = cfg.backgroundUrl.startsWith('data:image/')

  useEffect(() => {
    let alive = true
    void fetchConfig().then((c) => {
      if (alive) setCfg(c)
    })
    const onConfig = (): void => {
      void fetchConfig().then((c) => {
        if (alive) setCfg(c)
      })
    }
    window.addEventListener(AURORA_EVENT, onConfig)
    return () => {
      alive = false
      window.removeEventListener(AURORA_EVENT, onConfig)
    }
  }, [])

  /** 写入并派发事件（皮肤实时重绘）。 */
  const write = (patch: Partial<AuroraCardConfig>): void => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    void writeConfig(next).then((ok) => {
      if (ok) window.dispatchEvent(new Event(AURORA_EVENT))
      else window.alert('背景设置保存失败')
    })
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file === undefined) return
    try {
      write({ backgroundUrl: await fileToDataUrl(file) })
    } catch (err) {
      window.alert(`图片读取失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className={cls('auroraSection')}>
      <div className={cls('auroraSectionTitle')}>自定义背景图</div>
      <div className={cls('auroraField')}>
        <button type="button" className={cls('auroraFileBtn')} onClick={() => fileRef.current?.click()}>
          选择本地图片…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickFile(e)}
        />
      </div>
      {isData ? (
        <div className={cls('auroraField')}>
          <span
            className={cls('auroraThumb')}
            style={{ backgroundImage: `url("${cfg.backgroundUrl}")` }}
            role="img"
            aria-label="背景图预览"
          />
          <button type="button" className={cls('auroraFileBtn')} onClick={() => write({ backgroundUrl: '' })}>
            清除
          </button>
        </div>
      ) : (
        <div className={cls('auroraField')}>
          <input
            className={cls('auroraUrl')}
            type="text"
            value={cfg.backgroundUrl}
            placeholder="https://example.com/bg.jpg（留空用极光渐变）"
            onChange={(e) => write({ backgroundUrl: e.target.value })}
          />
        </div>
      )}
      <div className={cls('auroraField')}>
        <span className={cls('auroraFieldLabel')}>不透明度：{Math.round(cfg.opacity * 100)}%</span>
        <input
          className={cls('auroraRange')}
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={cfg.opacity}
          onChange={(e) => write({ opacity: Number(e.target.value) })}
        />
      </div>
      <div className={cls('auroraField')}>
        <span className={cls('auroraFieldLabel')}>背景模糊：{cfg.blur}px</span>
        <input
          className={cls('auroraRange')}
          type="range"
          min={0}
          max={40}
          step={1}
          value={cfg.blur}
          onChange={(e) => write({ blur: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
