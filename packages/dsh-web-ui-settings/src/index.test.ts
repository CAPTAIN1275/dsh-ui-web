/**
 * Minimal smoke tests for dsh-web-ui-settings (the CI gate requires at least
 * one test file per package; the group card is a thin slot registration).
 * @module @captain1275/dsh-client-ui-web-ui-settings
 */
import { describe, expect, it } from 'vitest'
import { en, zh, type WebUIPluginsKey } from './client/locales.ts'

describe('dsh-web-ui-settings locales', () => {
  it('defines the Web UI plugin group copy in zh', () => {
    expect(zh['title']).toBe('Web UI 插件')
  })

  it('zh and en share the same key set', () => {
    const zhKeys = Object.keys(zh).sort() as WebUIPluginsKey[]
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})
