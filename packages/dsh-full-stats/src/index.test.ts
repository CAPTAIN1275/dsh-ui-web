/**
 * Minimal smoke tests for dsh-full-stats (the CI gate requires at least one
 * test file per package; the plugin logic itself is thin route + line wiring).
 * @module @captain1275/dsh-full-stats
 */
import { describe, expect, it } from 'vitest'
import { name, FULL_STATS_API_PREFIX } from './index.ts'

describe('dsh-full-stats host', () => {
  it('exports a stable cordis plugin name', () => {
    expect(name).toBe('ui-full-stats')
  })

  it('exposes the config route prefix under /api', () => {
    expect(FULL_STATS_API_PREFIX).toBe('/api/full-stats')
  })
})
