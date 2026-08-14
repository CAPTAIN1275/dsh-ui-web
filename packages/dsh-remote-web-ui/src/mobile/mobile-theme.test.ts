// @vitest-environment jsdom
/** mobile-theme: light default, persisted dark toggle, document wiring. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMobileTheme, initMobileTheme, setMobileTheme, subscribeMobileTheme, toggleMobileTheme,
} from './mobile-theme.ts'

const STORAGE_KEY = 'dsh.remote.theme'

/** jsdom in this setup ships a bare localStorage object; install a real fake. */
function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  } as Storage
}

let storage: Storage

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal('localStorage', storage)
  setMobileTheme('light')
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mobile-theme', () => {
  it('defaults to light with nothing stored', () => {
    expect(getMobileTheme()).toBe('light')
  })

  it('toggles to dark, persists it, and wires the document', () => {
    expect(toggleMobileTheme()).toBe('dark')
    expect(getMobileTheme()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(storage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('toggles back to light', () => {
    toggleMobileTheme()
    expect(toggleMobileTheme()).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(storage.getItem(STORAGE_KEY)).toBe('light')
  })

  it('updates the browser chrome color along with the theme', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
    setMobileTheme('dark')
    expect(meta.content).toBe('#111418')
    setMobileTheme('light')
    expect(meta.content).toBe('#f3f5f9')
    meta.remove()
  })

  it('boot reads the stored theme and initMobileTheme applies it', async () => {
    storage.setItem(STORAGE_KEY, 'dark')
    vi.resetModules()
    const fresh = await import('./mobile-theme.ts')
    expect(fresh.getMobileTheme()).toBe('dark')
    fresh.initMobileTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('notifies subscribers on change', () => {
    const seen: string[] = []
    const unsubscribe = subscribeMobileTheme(() => { seen.push(getMobileTheme()) })
    setMobileTheme('dark')
    setMobileTheme('light')
    unsubscribe()
    setMobileTheme('dark')
    expect(seen).toEqual(['dark', 'light'])
  })
})
