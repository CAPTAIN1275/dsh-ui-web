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

/** DeepSeek 官方定价（2026-08，元/百万 token，来源 api-docs.deepseek.com/quick_start/pricing）。 */
/** deepseek-v4-flash：缓存命中 0.02 / 缓存未命中 1 / 输出 2。 */
export const DEEPSEEK_FLASH_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02 }
/** deepseek-v4-pro：缓存命中 0.025 / 缓存未命中 3 / 输出 6。 */
export const DEEPSEEK_RATES: CostRates = { inputPerM: 3, outputPerM: 6, cachePerM: 0.025 }
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
export const DEEPSEEK_LEGACY_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5 }
export const DEEPSEEK_REASONER_RATES: CostRates = { inputPerM: 4, outputPerM: 16, cachePerM: 1 }
/** 未知模型回退通用档。 */
export const GENERIC_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02 }

/**
 * 按模型名取单价。
 * - 含 "flash" → v4-flash 档（0.02 / 1 / 2）
 * - 含 "reasoner"/"r1" → 推理档
 * - 含 "v4-pro"/"pro" → v4-pro 档
 * - 含 "deepseek" → 旧标准档
 * - 其余回退通用档
 * @param model - 模型标识（如 deepseek/deepseek-chat）。
 * @returns 单价。
 */
export function ratesForModel(model: string): CostRates {
  const m = model.toLowerCase()
  if (m.includes('flash')) return DEEPSEEK_FLASH_RATES
  if (m.includes('reasoner') || m.includes('/r1') || m.includes('-r1')) return DEEPSEEK_REASONER_RATES
  if (m.includes('pro') || m.includes('v4-pro')) return DEEPSEEK_RATES
  if (m.includes('deepseek')) return DEEPSEEK_LEGACY_RATES
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
