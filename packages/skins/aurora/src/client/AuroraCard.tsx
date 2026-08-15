/**
 * aurora 皮肤设置行：注册进「设置-通用」（settings.general.item，官方插槽）。
 * 提供自定义背景图：本地选取（自动压缩为 data URL 持久化）或输入 URL，附清除按钮；
 * 以及不透明度与模糊调节。数据经注入面读写 skin-aurora 设置 scope。
 */
import { useRef, useSyncExternalStore } from 'react'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import css from './aurora.module.css'

/** 设置值形状（与宿主 schema 对应）。 */
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

/** 注入面：组件经 props 接收。 */
export interface AuroraCardInjected {
  useAurora: () => SettingsScopeSnapshot<AuroraCardConfig>
  setField: (field: string, value: unknown) => Promise<void>
}

/** 解析一个模块类名。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

/** 本地图片转压缩 data URL（视频直接传原始文件，不走这里）。 */
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

/** 判断当前背景是否为本地选取（data URL、blob 或宿主 media 路由）。 */
function isLocalMedia(value: string): boolean {
  return value.startsWith('data:image/')
    || value.startsWith('blob:')
    || value.includes('/api/skin-aurora/media/')
}

/** 设置卡片组件。 */
export function AuroraCard({ useAurora, setField }: AuroraCardInjected) {
  const snap = useAurora()
  const cfg: AuroraCardConfig = { ...DEFAULTS, ...(snap.value ?? {}) }
  const fileRef = useRef<HTMLInputElement | null>(null)

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
      // 直接传原始二进制（避免 base64 内存膨胀），host 持久化到磁盘。
      const url = await uploadMedia(uploadFile)
      await setField('backgroundUrl', url)
      await setField('mediaType', file.type.startsWith('video/') ? 'video' : 'image')
    } catch (err) {
      window.alert(`文件上传失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onUrlChange = (value: string): void => {
    void setField('backgroundUrl', value)
    void setField('mediaType', detectMediaType(value))
  }

  return (
    <div className={cls('auroraCard')}>
      <div className={cls('auroraCardHead')}>
        <span className={cls('auroraCardTitle')}>极光皮肤（自定义背景图）</span>
        <button
          type="button"
          className={`${cls('auroraSwitch')}${cfg.enabled ? ` ${cls('auroraSwitchOn')}` : ''}`}
          aria-pressed={cfg.enabled}
          onClick={() => void setField('enabled', !cfg.enabled)}
        >
          <span className={cls('auroraSwitchThumb')} />
        </button>
      </div>
      <p className={cls('auroraCardDesc')}>
        自定义界面背景：本地选图/视频或填 URL（留空使用内置极光渐变），支持动图、视频、透明度与模糊。
      </p>
      {cfg.enabled && (
        <div className={cls('auroraCardBody')}>
          {isLocalMedia(cfg.backgroundUrl) ? (
            <div className={cls('auroraLocal')}>
              <span className={cls('auroraLocalLabel')}>当前使用本地媒体</span>
              {cfg.mediaType === 'video' ? (
                <video
                  src={cfg.backgroundUrl}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className={cls('auroraLocalThumb')}
                  style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }}
                />
              ) : (
                <span
                  className={cls('auroraLocalThumb')}
                  style={{ backgroundImage: `url("${cfg.backgroundUrl}")` }}
                  role="img"
                  aria-label="背景预览"
                />
              )}
              <button type="button" className={cls('auroraBtn')} onClick={() => void setField('backgroundUrl', '')}>
                更换
              </button>
              <button type="button" className={cls('auroraBtn')} onClick={() => void setField('backgroundUrl', '')}>
                清除
              </button>
            </div>
          ) : (
            <label className={cls('auroraField')}>
              <span>背景 URL（图片/动图/视频，留空使用极光渐变）</span>
              <input
                type="text"
                value={cfg.backgroundUrl}
                placeholder="https://example.com/bg.jpg 或 bg.mp4"
                onChange={(e) => onUrlChange(e.target.value)}
              />
            </label>
          )}
          <div className={cls('auroraField')}>
            <span>本地选取背景</span>
            <button type="button" className={cls('auroraBtn')} onClick={() => fileRef.current?.click()}>
              选择文件…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={(e) => void onPickFile(e)}
            />
          </div>
          {cfg.mediaType === 'video' && cfg.backgroundUrl !== '' && (
            <label className={cls('auroraField')}>
              <input
                type="checkbox"
                checked={cfg.muted}
                onChange={(e) => void setField('muted', e.target.checked)}
              />
              <span>静音循环播放（取消勾选后视频带声音）</span>
            </label>
          )}
          <label className={cls('auroraField')}>
            <span>不透明度：{Math.round(cfg.opacity * 100)}%</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={cfg.opacity}
              onChange={(e) => void setField('opacity', Number(e.target.value))}
            />
          </label>
          <label className={cls('auroraField')}>
            <span>背景模糊：{cfg.blur}px</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={cfg.blur}
              onChange={(e) => void setField('blur', Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  )
}
