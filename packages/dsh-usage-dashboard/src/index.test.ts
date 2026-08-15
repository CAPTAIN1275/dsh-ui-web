/**
 * Smoke tests for dsh-usage-dashboard: aggregation math, day keys, session
 * ranking, and the recent-days window (the CI gate requires at least one
 * test file per package).
 * @module @captain1275/dsh-usage-dashboard
 */
import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import {
  applyRecord,
  dayKey,
  emptyUsage,
  recentDays,
  sessionRanking,
  type UsageRecord,
} from './index.ts'

const base: UsageRecord = {
  sessionId: 's1',
  sessionTitle: '会话 A',
  model: 'deepseek/deepseek-chat',
  ts: Date.now(),
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 20,
}

describe('usage aggregation', () => {
  it('accumulates records into session/day/model buckets and totals', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    applyRecord(store, { ...base, sessionId: 's2', sessionTitle: '会话 B', model: 'deepseek/deepseek-reasoner', inputTokens: 200, outputTokens: 30 })

    expect(store.total.inputTokens).toBe(300)
    expect(store.total.outputTokens).toBe(80)
    expect(store.total.cacheReadTokens).toBe(40)
    expect(store.total.calls).toBe(2)

    expect(store.bySession['s1']?.inputTokens).toBe(100)
    expect(store.bySession['s2']?.outputTokens).toBe(30)

    const day = dayKey(base.ts)
    expect(store.byDay[day]?.calls).toBe(2)

    expect(store.byModel['deepseek/deepseek-chat']?.calls).toBe(1)
    expect(store.byModel['deepseek/deepseek-reasoner']?.calls).toBe(1)
  })

  it('aggregates multiple records for the same session', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    applyRecord(store, { ...base, inputTokens: 50, outputTokens: 25 })
    expect(store.bySession['s1']?.inputTokens).toBe(150)
    expect(store.bySession['s1']?.outputTokens).toBe(75)
    expect(store.bySession['s1']?.calls).toBe(2)
  })

  it('ranks sessions by total tokens descending', () => {
    const store = emptyUsage()
    applyRecord(store, base) // s1: 170 total
    applyRecord(store, { ...base, sessionId: 's2', sessionTitle: 'B', inputTokens: 500, outputTokens: 100 }) // s2: 620
    const ranked = sessionRanking(store, 10)
    expect(ranked[0]?.id).toBe('s2')
    expect(ranked[0]?.totalTokens).toBe(620)
    expect(ranked[1]?.id).toBe('s1')
  })

  it('fills the recent-days window with zeros for empty days', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    const days = recentDays(store, 14)
    expect(days).toHaveLength(14)
    // The recorded day has the tokens; at least one other day is zero.
    const today = dayKey(Date.now())
    expect(days.find((d) => d.day === today)?.calls).toBe(1)
    expect(days.some((d) => d.calls === 0)).toBe(true)
  })
})

describe('usage helpers', () => {
  it('formats day keys in local time', () => {
    expect(dayKey(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('tolerates missing usage file', () => {
    const home = join(tmpdir(), `usage-test-${process.pid}-${Date.now()}`)
    process.env.DSH_HOME = home
    try {
      // readUsage returns empty when the file is absent.
      const { readUsage } = require('./index.ts') as typeof import('./index.ts')
      expect(readUsage().total.calls).toBe(0)
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })
})
