/**
 * Tests for the cost estimator: per-model rates and the estimate math.
 * @module @captain1275/dsh-usage-dashboard/cost
 */
import { describe, expect, it } from 'vitest'
import { DEEPSEEK_RATES, estimateCost, ratesForModel } from './cost.ts'

describe('ratesForModel', () => {
  it('uses the deepseek standard rate for deepseek models', () => {
    expect(ratesForModel('deepseek/deepseek-chat')).toBe(DEEPSEEK_RATES)
    expect(ratesForModel('deepseek-v4-flash')).toBe(DEEPSEEK_RATES)
  })

  it('uses the reasoner rate for reasoning models', () => {
    expect(ratesForModel('deepseek/deepseek-reasoner').inputPerM).toBe(4)
    expect(ratesForModel('deepseek-reasoner-v2').inputPerM).toBe(4)
  })

  it('falls back to the generic rate for unknown models', () => {
    // Generic and deepseek standard rates coincide today; assert the shape.
    expect(ratesForModel('openai/gpt-4o')).toEqual(DEEPSEEK_RATES)
  })
})

describe('estimateCost', () => {
  it('computes 1M input at the deepseek rate = 3 yuan', () => {
    expect(estimateCost('deepseek/deepseek-chat', 1_000_000, 0, 0)).toBe(3)
  })

  it('computes output and cache portions', () => {
    // 1M output at 6/M + 1M cache at 1/M + 1M input at 3/M = 10
    expect(estimateCost('deepseek/deepseek-chat', 1_000_000, 1_000_000, 1_000_000)).toBe(10)
  })

  it('handles fractional token counts', () => {
    expect(estimateCost('deepseek/deepseek-chat', 250_000, 0, 0)).toBe(0.75)
  })

  it('rounds to 4 decimals', () => {
    expect(estimateCost('deepseek/deepseek-chat', 123_456, 0, 0)).toBeCloseTo(0.3704, 3)
  })
})
