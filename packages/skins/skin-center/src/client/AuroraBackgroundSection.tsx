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
  mediaType: 'image' | 'video'
  muted: boolean
}

const DEFAULTS: AuroraCardConfig = {
  enabled: true,
  backgroundUrl: '',
  opacity: 0.8,
  blur: 0,
  mediaType: 'image',
  muted: true,
}

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
        mediaType: data.config.mediaType === 'video' ? 'video' : 'image',
        muted: typeof data.config.muted === 'boolean' ? data.config.muted : DEFAULTS.muted,
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

/** 本地图片转压缩 data URL（视频直接传原始文件，不转 data URL）。 */
async function fileToDataUrl(file: File, maxDim = 1920): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
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

/** 上传媒体到宿主（原始二进制，避免 base64 内存膨胀），返回持久 URL。 */
async function uploadMedia(file: File): Promise<string> {
  const res = await fetch('/api/skin-aurora/upload', {
    method: 'POST',
    headers: { 'X-File-Name': encodeURIComponent(file.name) },
    body: file,
  })
  const data = (await res.json()) as { ok?: boolean; url?: string; error?: string }
  if (!res.ok || data.ok !== true || data.url === undefined) {
    throw new Error(data.error ?? `upload failed: ${res.status}`)
  }
  return data.url
}

/** 按 URL 推断媒体类型（视频扩展名 → video，其余 → image）。 */
function detectMediaType(url: string): 'image' | 'video' {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) ? 'video' : 'image'
}

/** Aurora 卡片内的自定义背景区块。 */
export function AuroraBackgroundSection() {
  const [cfg, setCfg] = useState<AuroraCardConfig>(DEFAULTS)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // 本地选取/上传的媒体（data URL、blob 或宿主 media 路由）→ 显示预览 + 清除。
  const isLocal = cfg.backgroundUrl.startsWith('data:image/')
    || cfg.backgroundUrl.startsWith('blob:')
    || cfg.backgroundUrl.includes('/api/skin-aurora/media/')

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
      let uploadFile = file
      if (!file.type.startsWith('video/')) {
        // 图片/动图：压缩为小 data URL 后转回 Blob 上传（省存储）。
        const dataUrl = await fileToDataUrl(file)
        const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
        const b64 = dataUrl.split(',')[1]!
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        uploadFile = new File([bytes], file.name, { type: mime })
      }
      // 直接传原始二进制（避免 base64 内存膨胀），host 持久化。
      const url = await uploadMedia(uploadFile)
      write({ backgroundUrl: url, mediaType: file.type.startsWith('video/') ? 'video' : 'image' })
    } catch (err) {
      window.alert(`文件上传失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onUrlChange = (value: string): void => {
    write({ backgroundUrl: value, mediaType: detectMediaType(value) })
  }

  return (
    <div className={cls('auroraSection')}>
      <div className={cls('auroraSectionTitle')}>自定义背景（图片 / 动图 / 视频）</div>
      <div className={cls('auroraField')}>
        <button type="button" className={cls('auroraFileBtn')} onClick={() => fileRef.current?.click()}>
          选择本地文件…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickFile(e)}
        />
      </div>
      {isLocal ? (
        <div className={cls('auroraField')}>
          <span
            className={cls('auroraThumb')}
            style={cfg.mediaType === 'video'
              ? undefined
              : { backgroundImage: `url("${cfg.backgroundUrl}")` }}
            role="img"
            aria-label="背景预览"
          >
            {cfg.mediaType === 'video' && (
              <video src={cfg.backgroundUrl} muted loop playsInline autoPlay style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }} />
            )}
          </span>
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
            placeholder="https://example.com/bg.jpg 或 bg.mp4（留空用极光渐变）"
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
      )}
      {cfg.mediaType === 'video' && cfg.backgroundUrl !== '' && (
        <label className={cls('auroraField')}>
          <input
            type="checkbox"
            checked={cfg.muted}
            onChange={(e) => write({ muted: e.target.checked })}
          />
          <span>静音循环播放（取消勾选后视频带声音）</span>
        </label>
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
      <GlassSliders />
    </div>
  )
}

/**
 * 液态玻璃调节（照搬 aqua 的 blur/frost 机制）：滑块写 localStorage
 * （dsh.ui-skin-aurora.blur/frost，AquaLayer 读取），并派发 AURORA_EVENT
 * 让 aurora 皮肤即时应用。滑块值只在本地保存（浏览器 localStorage）。
 */
function GlassSliders(): JSX.Element {
  const readNum = (key: string, fallback: number): number => {
    try {
      const raw = localStorage.getItem(key)
      const n = raw === null ? Number.NaN : Number(raw)
      return Number.isFinite(n) ? n : fallback
    } catch {
      return fallback
    }
  }
  const [blur, setBlur] = useState(() => readNum('dsh.ui-skin-aurora.blur', 14))
  const [frost, setFrost] = useState(() => readNum('dsh.ui-skin-aurora.frost', 50))

  const applyGlass = (key: string, value: number, set: (v: number) => void): void => {
    set(value)
    try {
      localStorage.setItem(key, String(value))
    } catch {
      /* localStorage 不可用时仅本次生效 */
    }
    window.dispatchEvent(new Event(AURORA_EVENT))
  }

  return (
    <div className={cls('auroraGlass')}>
      <div className={cls('auroraField')}>
        <span className={cls('auroraFieldLabel')}>玻璃模糊：{blur}px</span>
        <input
          className={cls('auroraRange')}
          type="range"
          min={0}
          max={40}
          step={1}
          value={blur}
          onChange={(e) => applyGlass('dsh.ui-skin-aurora.blur', Number(e.target.value), setBlur)}
        />
      </div>
      <div className={cls('auroraField')}>
        <span className={cls('auroraFieldLabel')}>玻璃磨砂：{frost}</span>
        <input
          className={cls('auroraRange')}
          type="range"
          min={0}
          max={100}
          step={1}
          value={frost}
          onChange={(e) => applyGlass('dsh.ui-skin-aurora.frost', Number(e.target.value), setFrost)}
        />
      </div>
    </div>
  )
}
