/**
 * Localized wire/type surface for @deepseek-ai/dsh-token-meter's client
 * namespace.
 *
 * The dsh source checkout's token-meter carries a personal customization —
 * the liveTokenUsage projection (per-step token estimates plus generation
 * throughput) that this plugin registers into the session-projection map
 * table. The official package does not export it, so the types are declared
 * here (structural copies of the customized projection interfaces) and the
 * map-table augmentation is re-declared against the official
 * session-projection types.
 */

declare module '@deepseek-ai/dsh-token-meter/client' {
  /** Durable provider usage accumulated across the complete durable log. */
  export interface TokenUsageProjection {
    uncachedInputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }

  /** Live per-step token estimates plus generation throughput. */
  export interface LiveTokenUsageProjection extends TokenUsageProjection {
    /** True while any active step's buckets are heuristic estimates. */
    estimated: boolean
    /** Output tokens per second of the active (or latest settled) step. */
    tokensPerSecond?: number
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Live per-step token estimates plus generation throughput. */
    liveTokenUsage: import('@deepseek-ai/dsh-token-meter/client').LiveTokenUsageProjection
  }

  interface SessionProjectionStateMap {
    /** Internal fold state of the liveTokenUsage unit (src/projection.ts). */
    liveTokenUsage: import('../projection.ts').State
  }
}

// rc.2's root module re-exports the map table from ./types; augmenting the
// submodule alone does not widen the root's generic constraint, so augment
// the package root too (same symbol identity per the SDK's own docs).
declare module '@deepseek-ai/dsh-session-projection' {
  interface SessionProjectionMap {
    /** Live per-step token estimates plus generation throughput. */
    liveTokenUsage: import('@deepseek-ai/dsh-token-meter/client').LiveTokenUsageProjection
  }

  interface SessionProjectionStateMap {
    /** Internal fold state of the liveTokenUsage unit (src/projection.ts). */
    liveTokenUsage: import('../projection.ts').State
  }
}

// Module-augmentation marker: makes this file an external module so the
// declare module blocks above merge (augment) their targets instead of
// shadowing them as ambient declarations.
export {}

