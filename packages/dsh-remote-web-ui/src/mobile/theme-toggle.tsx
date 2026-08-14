/**
 * Theme toggle button: sits at the right end of every view header and flips
 * the mobile surface between the light (default) and dark palettes. The
 * glyph shows the theme you will switch TO (moon in light mode, sun in dark
 * mode); the choice persists across visits.
 */

import { useSyncExternalStore } from 'react'
import { getMobileTheme, subscribeMobileTheme, toggleMobileTheme } from './mobile-theme.ts'

/** Sun glyph: circle + eight rays (inline SVG, no emoji). */
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
    </svg>
  )
}

/** Moon glyph: crescent path (inline SVG, no emoji). */
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

/**
 * Render the header theme toggle.
 * @returns the toggle button.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeMobileTheme, getMobileTheme)
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="mobile-theme-toggle"
      aria-label={dark ? '切换到浅色' : '切换到深色'}
      onClick={() => { toggleMobileTheme() }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
