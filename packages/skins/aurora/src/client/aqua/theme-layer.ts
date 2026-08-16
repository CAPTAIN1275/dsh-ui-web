/**
 * 极光玻璃层（aqua 机制照搬，已按要求删除流光背景）：只保留玻璃效果——
 * html 属性（data-dsh-aurora）驱动玻璃 CSS、blur/frost 变量写入。
 * 流体 shader / ambient 动画背景 / 鲸鱼 / 生物装饰已删（见 aqua/ 目录精简）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { startSeamStamper } from './seam-stamper.ts'

/** html attribute selecting the glass layer: the stylesheet only applies under it. */
export const AQUA_ATTRIBUTE = 'data-dsh-aurora'

/** localStorage key carrying the layer enable flag. */
export const AQUA_ENABLED_KEY = 'dsh.ui-skin-aurora.enabled'

/** Default state when nothing is stored yet: on. */
export const DEFAULT_ENABLED = true

/** Numeric knob keys and their localStorage names (aqua 原键名，皮肤中心滑块读写). */
const NUMERIC_KEYS = {
  blur: 'dsh.ui-skin-aurora.blur',
  frost: 'dsh.ui-skin-aurora.frost',
} as const

type NumericKey = keyof typeof NUMERIC_KEYS

/** 玻璃默认值（比 aqua 原值提高：blur 2→14、frost 20→50，让玻璃效果默认可见）。 */
const SETTINGS_DEFAULTS = {
  blur: 14,
  frost: 50,
} as const

/** Read the persisted enable flag (absent storage means on). */
function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(AQUA_ENABLED_KEY)
    return raw === null ? DEFAULT_ENABLED : raw === 'true'
  } catch {
    return DEFAULT_ENABLED
  }
}

/** Persist the enable flag (storage failures keep the in-memory state). */
function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(AQUA_ENABLED_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Clamp a numeric knob into its sane range. */
function clampSetting(key: NumericKey, value: number): number {
  const max = key === 'blur' ? 40 : 100
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : SETTINGS_DEFAULTS[key]
}

/** Read one numeric knob from localStorage (absent/parse failure means the default). */
function readSetting(key: NumericKey): number {
  try {
    const raw = localStorage.getItem(NUMERIC_KEYS[key])
    return raw === null ? SETTINGS_DEFAULTS[key] : clampSetting(key, Number(raw))
  } catch {
    return SETTINGS_DEFAULTS[key]
  }
}

/** Persist one numeric knob (storage failures keep the in-memory state). */
function writeSetting(key: NumericKey, value: number): void {
  try {
    localStorage.setItem(NUMERIC_KEYS[key], String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/**
 * 玻璃层：owns the enable flag and applies/retracts the glass CSS hook
 * (html 属性) plus the blur/frost variables. 皮肤中心极光卡片经
 * localStorage + AURORA_EVENT 驱动 setBlur/setFrost。
 */
export class AquaLayer {
  private enabled = false
  private settings = { blur: readSetting('blur'), frost: readSetting('frost') }
  private seamDisposer: (() => void) | undefined
  private readonly ctx: Context

  /**
   * @param ctx - owning client context (effect lifecycle releases the layer).
   */
  constructor(ctx: Context) {
    this.ctx = ctx
    ctx.effect(() => {
      const onStorage = (event: StorageEvent): void => {
        const key = event.key
        if (key === AQUA_ENABLED_KEY) {
          this.enabled = readEnabled()
          this.sync()
        }
        if (key !== null && (key === NUMERIC_KEYS.blur || key === NUMERIC_KEYS.frost)) {
          this.settings.blur = readSetting('blur')
          this.settings.frost = readSetting('frost')
          if (this.enabled) this.applySettings()
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('storage', onStorage)
        this.unmount()
      }
    }, 'ui-skin-aurora: glass layer lifecycle')
    this.enabled = readEnabled()
    this.sync()
  }

  /** Current enable state. */
  getEnabled(): boolean {
    return this.enabled
  }

  /** Current knob values. */
  getSettings(): { blur: number; frost: number } {
    return { ...this.settings }
  }

  /** Flip the layer: persist, then apply or retract every owned effect. */
  setEnabled(value: boolean): void {
    if (value === this.enabled) return
    this.enabled = value
    writeEnabled(value)
    this.sync()
  }

  /** Set the glass blur radius (px). */
  setBlur(value: number): void {
    const next = clampSetting('blur', value)
    if (next === this.settings.blur) return
    this.settings.blur = next
    writeSetting('blur', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the glass frost amount (0-100). */
  setFrost(value: number): void {
    const next = clampSetting('frost', value)
    if (next === this.settings.frost) return
    this.settings.frost = next
    writeSetting('frost', next)
    if (this.enabled) this.applySettings()
  }

  private sync(): void {
    if (this.enabled) this.mount()
    else this.unmount()
  }

  /** Write the knob-driven CSS variables onto <html> (aqua 原算法，无强制：
   *  值完全由皮肤中心「玻璃模糊」「玻璃磨砂」滑块控制，用户自己调)。 */
  private applySettings(): void {
    const style = document.documentElement.style
    style.setProperty('--dsh-aurora-blur', `${this.settings.blur}px`)
    // Frost 0-100 → a 0-1.4 alpha multiplier (50 = 1x)。
    style.setProperty('--dsh-aurora-frost', String(Math.min(this.settings.frost / 50, 1.4)))
    style.setProperty('--dsh-aurora-surface-frost', String(Math.min((this.settings.frost + 20) / 50, 1.4)))
  }

  private mount(): void {
    document.documentElement.setAttribute(AQUA_ATTRIBUTE, '')
    this.applySettings()
    this.startSeamStamper()
  }

  private unmount(): void {
    document.documentElement.removeAttribute(AQUA_ATTRIBUTE)
    this.seamDisposer?.()
    this.seamDisposer = undefined
  }

  /** Stamp the data-* seams the stylesheet keys off (glass surfaces). */
  private startSeamStamper(): void {
    if (this.seamDisposer !== undefined) return
    this.seamDisposer = startSeamStamper()
  }
}
