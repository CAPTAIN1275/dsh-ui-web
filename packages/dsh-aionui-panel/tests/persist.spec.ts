/**
 * Persistence contract tests: stored numbers must be range-validated (a
 * broken or hand-edited value falls back to the default — never a 0px or NaN
 * panel), and the preview-scope registry evicts beyond the 12-scope cap.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREVIEW_SCOPE_CAP, PREVIEW_SCOPE_PREFIX, evictPreviewScopes, listPreviewScopes,
  readJson, readStoredNumber, writeJson, writeStoredNumber,
} from '../src/client/persist.ts'

beforeEach(() => {
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key !== null) localStorage.removeItem(key)
  }
})

describe('readStoredNumber', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(readStoredNumber('chat-workspace-width-px', 220, 500, 260)).toBe(260)
  })

  it('reads a valid stored value', () => {
    localStorage.setItem('chat-workspace-width-px', '330')
    expect(readStoredNumber('chat-workspace-width-px', 220, 500, 260)).toBe(330)
  })

  it('falls back on out-of-range, NaN, and garbage values', () => {
    localStorage.setItem('k', '0')
    expect(readStoredNumber('k', 220, 500, 260)).toBe(260)
    localStorage.setItem('k', '9999')
    expect(readStoredNumber('k', 220, 500, 260)).toBe(260)
    localStorage.setItem('k', 'abc')
    expect(readStoredNumber('k', 220, 500, 260)).toBe(260)
    localStorage.setItem('k', '')
    expect(readStoredNumber('k', 220, 500, 260)).toBe(260)
    localStorage.setItem('k', '260.7')
    expect(readStoredNumber('k', 220, 500, 260)).toBe(260.7)
  })
})

describe('writeStoredNumber', () => {
  it('rounds and writes', () => {
    writeStoredNumber('k', 260.4)
    expect(localStorage.getItem('k')).toBe('260')
  })
})

describe('preview scope registry', () => {
  it('lists scopes with savedAt', () => {
    writeJson('preview-ui:/a', { savedAt: 10, tabs: [] })
    writeJson('preview-ui:/b', { savedAt: 20, tabs: [] })
    const scopes = listPreviewScopes()
    expect(scopes).toEqual([{ root: '/a', savedAt: 10 }, { root: '/b', savedAt: 20 }])
  })

  it('evicts the oldest scopes beyond the cap', () => {
    for (let i = 0; i < PREVIEW_SCOPE_CAP + 3; i += 1) {
      writeJson(`${PREVIEW_SCOPE_PREFIX}/p${i}`, { savedAt: i, tabs: [] })
    }
    evictPreviewScopes(`/p${PREVIEW_SCOPE_CAP + 2}`)
    const scopes = listPreviewScopes()
    expect(scopes.length).toBe(PREVIEW_SCOPE_CAP)
    expect(scopes[0].root).toBe('/p3')
    expect(scopes.some((scope) => scope.root === '/p0')).toBe(false)
    expect(scopes.some((scope) => scope.root === `/p${PREVIEW_SCOPE_CAP + 2}`)).toBe(true)
  })
})

describe('readJson', () => {
  it('falls back on invalid JSON', () => {
    localStorage.setItem('k', '{broken')
    expect(readJson('k', { fallback: true })).toEqual({ fallback: true })
  })
})
