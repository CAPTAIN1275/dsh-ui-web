/**
 * Smoke tests for dsh-full-stats: host route wiring and the extended
 * three-field config (thinking/working/done) persistence.
 * @module @captain1275/dsh-full-stats
 */
import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { name, FULL_STATS_API_PREFIX, readConfig } from './index.ts'

describe('dsh-full-stats host', () => {
  it('exports a stable cordis plugin name', () => {
    expect(name).toBe('ui-full-stats')
  })

  it('exposes the config route prefix under /api', () => {
    expect(FULL_STATS_API_PREFIX).toBe('/api/full-stats')
  })
})

describe('dsh-full-stats config (thinking/working/done)', () => {
  it('defaults all three fields to empty when the file is absent', () => {
    const home = join(tmpdir(), `full-stats-test-${process.pid}-${Date.now()}`)
    process.env.DSH_HOME = home
    try {
      const cfg = readConfig()
      expect(cfg.thinkingText).toBe('')
      expect(cfg.workingText).toBe('')
      expect(cfg.doneText).toBe('')
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('round-trips the thinkingText field from disk', () => {
    const home = join(tmpdir(), `full-stats-test-${process.pid}-${Date.now()}`)
    process.env.DSH_HOME = home
    try {
      mkdirSync(home, { recursive: true })
      writeFileSync(join(home, 'full-stats.json'), JSON.stringify({
        thinkingText: 'DeepSleep',
        workingText: '工作中',
        doneText: '完成',
      }), 'utf8')
      const cfg = readConfig()
      expect(cfg.thinkingText).toBe('DeepSleep')
      expect(cfg.workingText).toBe('工作中')
      expect(cfg.doneText).toBe('完成')
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })
})
