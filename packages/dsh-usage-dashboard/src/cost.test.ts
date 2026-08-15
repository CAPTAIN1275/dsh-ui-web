/**
 * Tests for the cost estimator: per-model rates and the estimate math.
 * @module @captain1275/dsh-usage-dashboard/cost
 */
import { describe, expect, it } from 'vitest'
import { DEEPSEEK_FLASH_RATES, DEEPSEEK_LEGACY_RATES, estimateCost, ratesForModel } from './cost.ts'

describe('ratesForModel', () => {
  it('uses the flash rate for flash models (v4-flash)', () => {
    expect(ratesForModel('deepseek-v4-flash')).toBe(DEEPSEEK_FLASH_RATES)
    expect(ratesForModel('deepseek-v4-flash-0731')).toBe(DEEPSEEK_FLASH_RATES)
  })

  it('uses the legacy deepseek rate for old chat models', () => {
    expect(ratesForModel('deepseek/deepseek-chat')).toBe(DEEPSEEK_LEGACY_RATES)
  })

  it('uses the reasoner rate for reasoning models', () => {
    expect(ratesForModel('deepseek/deepseek-reasoner').inputPerM).toBe(4)
    expect(ratesForModel('deepseek-reasoner-v2').inputPerM).toBe(4)
  })

  it('falls back to the generic rate for unknown models', () => {
    expect(ratesForModel('openai/gpt-4o')).toEqual(DEEPSEEK_FLASH_RATES)
  })
})

describe('estimateCost', () => {
  it('computes 1M uncached input at the flash rate = 1 yuan', () => {
    expect(estimateCost('deepseek-v4-flash', 1_000_000, 0, 0)).toBe(1)
  })

  it('computes flash output and cache portions (output 2/M, cache 0.02/M)', () => {
    // 1M input(1) + 1M output(2) + 1M cache(0.02) = 3.02
    expect(estimateCost('deepseek-v4-flash', 1_000_000, 1_000_000, 1_000_000)).toBe(3.02)
  })

  it('handles fractional token counts', () => {
    expect(estimateCost('deepseek-v4-flash', 250_000, 0, 0)).toBe(0.25)
  })

  it('rounds to 4 decimals', () => {
    expect(estimateCost('deepseek-v4-flash', 123_456, 0, 0)).toBeCloseTo(0.1235, 3)
  })
})
