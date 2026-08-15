/**
 * dsh-usage-dashboard 费用估算。
 * 按模型前缀匹配单价（元 / 每百万 token），DeepSeek 官方主流定价为默认值；
 * 模型名不匹配时回退到通用档。估算仅用于看板展示，非计费依据。
 * @module @captain1275/dsh-usage-dashboard/cost
 */

/** 单模型单价（元 / 每百万 token）。 */
export interface CostRates {
  /** 未命中缓存的输入。 */
  inputPerM: number
  /** 输出。 */
  outputPerM: number
  /** 缓存命中输入。 */
  cachePerM: number
}

/** DeepSeek 官方定价（2025 年主流价格，元/百万 token）。 */
export const DEEPSEEK_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5 }
export const DEEPSEEK_REASONER_RATES: CostRates = { inputPerM: 4, outputPerM: 16, cachePerM: 1 }
export const GENERIC_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5 }

/**
 * 按模型名取单价。模型名含 "reasoner"/"r1" 用推理档，含 "deepseek" 用标准档，
 * 其余回退通用档。
 * @param model - 模型标识（如 deepseek/deepseek-chat）。
 * @returns 单价。
 */
export function ratesForModel(model: string): CostRates {
  const m = model.toLowerCase()
  if (m.includes('reasoner') || m.includes('/r1') || m.includes('-r1')) return DEEPSEEK_REASONER_RATES
  if (m.includes('deepseek')) return DEEPSEEK_RATES
  return GENERIC_RATES
}

/**
 * 估算一次用量的费用（元）。
 * @param model - 模型标识。
 * @param inputTokens - 输入 token（不含缓存）。
 * @param outputTokens - 输出 token。
 * @param cacheReadTokens - 缓存命中 token。
 * @param rates - 可选单价覆盖（测试用）。
 * @returns 估算费用（元，保留 4 位）。
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  rates: CostRates = ratesForModel(model),
): number {
  const input = inputTokens / 1_000_000 * rates.inputPerM
  const output = outputTokens / 1_000_000 * rates.outputPerM
  const cache = cacheReadTokens / 1_000_000 * rates.cachePerM
  return Math.round((input + output + cache) * 10_000) / 10_000
}
