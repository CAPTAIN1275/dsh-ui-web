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
}

const DEFAULTS: AuroraCardConfig = { enabled: true, backgroundUrl: '', opacity: 0.8, blur: 0 }

/** 注入面：组件经 props 接收。 */
export interface AuroraCardInjected {
  useAurora: () => SettingsScopeSnapshot<AuroraCardConfig>
  setField: (field: string, value: unknown) => Promise<void>
}

/** 解析一个模块类名。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

/** 本地图片转压缩 data URL（最长边 1920px、JPEG 0.85），用于持久化到设置。 */
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

/** 判断当前背景是否为本地选取的 data URL。 */
function isDataUrl(value: string): boolean {
  return value.startsWith('data:image/')
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
      const dataUrl = await fileToDataUrl(file)
      await setField('backgroundUrl', dataUrl)
    } catch (err) {
      window.alert(`图片读取失败：${err instanceof Error ? err.message : String(err)}`)
    }
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
        自定义界面背景：本地选图或填 URL（留空使用内置极光渐变），支持透明度与模糊。
      </p>
      {cfg.enabled && (
        <div className={cls('auroraCardBody')}>
          {isDataUrl(cfg.backgroundUrl) ? (
            <div className={cls('auroraLocal')}>
              <span className={cls('auroraLocalLabel')}>当前使用本地图片</span>
              <span
                className={cls('auroraLocalThumb')}
                style={{ backgroundImage: `url("${cfg.backgroundUrl}")` }}
                role="img"
                aria-label="背景图预览"
              />
              <button type="button" className={cls('auroraBtn')} onClick={() => void setField('backgroundUrl', '')}>
                更换
              </button>
              <button type="button" className={cls('auroraBtn')} onClick={() => void setField('backgroundUrl', '')}>
                清除
              </button>
            </div>
          ) : (
            <label className={cls('auroraField')}>
              <span>背景图 URL（留空使用极光渐变）</span>
              <input
                type="text"
                value={cfg.backgroundUrl}
                placeholder="https://example.com/bg.jpg"
                onChange={(e) => void setField('backgroundUrl', e.target.value)}
              />
            </label>
          )}
          <div className={cls('auroraField')}>
            <span>本地选取背景图</span>
            <button type="button" className={cls('auroraBtn')} onClick={() => fileRef.current?.click()}>
              选择图片…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => void onPickFile(e)}
            />
          </div>
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
