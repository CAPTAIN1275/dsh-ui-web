/**
 * Mobile-surface theme: light by default, dark via an explicit persisted
 * toggle. The standalone page boots without the shell, so there is no theme
 * system to inherit — the choice is stored in localStorage and applied as a
 * `data-theme` attribute on <html>; the stylesheet defines both palettes
 * under `:root` (light) / `:root[data-theme='dark']` (dark).
 *
 * A tiny module store (subscribe/get) keeps the toggle button and the boot
 * path in sync without threading props through the three view levels.
 */

export type MobileTheme = 'light' | 'dark'

const STORAGE_KEY = 'dsh.remote.theme'
const THEME_COLOR_META_NAME = 'theme-color'
const LIGHT_THEME_COLOR = '#f3f5f9'
const DARK_THEME_COLOR = '#111418'

let current: MobileTheme = readStored() ?? 'light'
const listeners = new Set<() => void>()

function readStored(): MobileTheme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : undefined
  } catch {
    return undefined
  }
}

function persist(theme: MobileTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private-mode storage failures are non-fatal; the session keeps the theme.
  }
}

/** Apply the theme to the document: data-theme attribute + browser chrome color. */
function applyToDocument(theme: MobileTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${THEME_COLOR_META_NAME}"]`)
  if (meta !== null) meta.content = theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR
}

/** Current theme (light unless the user explicitly toggled to dark). */
export function getMobileTheme(): MobileTheme {
  return current
}

/** Subscribe to theme changes; returns the unsubscribe function. */
export function subscribeMobileTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Set the theme explicitly (persisted + applied to the document). */
export function setMobileTheme(theme: MobileTheme): void {
  if (theme === current) return
  current = theme
  persist(theme)
  applyToDocument(theme)
  for (const listener of [...listeners]) listener()
}

/** Flip light/dark and return the new theme. */
export function toggleMobileTheme(): MobileTheme {
  setMobileTheme(current === 'light' ? 'dark' : 'light')
  return current
}

/** Apply the persisted (or default) theme once at boot, before first paint. */
export function initMobileTheme(): void {
  applyToDocument(current)
}
