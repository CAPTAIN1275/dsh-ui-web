/**
 * Affinity score — pure, clock-injected. The pet grows closer the more you
 * work together and care for it: every completed turn earns a small reward,
 * petting earns a tiny one (cooldown-gated), feeding earns the most.
 * Persistence lives in the service; this module only computes transitions.
 * @module @captain1275/dsh-pet/affinity
 */

/** One interaction the user can perform on the pet. */
export type PetInteraction = 'pet' | 'feed'

/** Affinity state as persisted. */
export interface AffinityState {
  /** Total affinity points, capped at AFFINITY_MAX. */
  points: number
  /** Epoch ms of the last pet interaction. */
  lastPetAt: number
  /** Epoch ms of the last feed. */
  lastFeedAt: number
  /** Total pet count (lifetime). */
  pets: number
  /** Total feed count (lifetime). */
  feeds: number
  /** Total completed turns witnessed (lifetime). */
  turns: number
  /** Time-output anchor: epoch ms the wall-clock companionship reward last advanced (0 = never). */
  lastTimeRewardAt: number
}

export const AFFINITY_MAX = 100

/** Affinity ranks by points; the pet visibly grows with its rank.
 *  Marker glyphs are plain ASCII (the repo bans all emoji characters);
 *  they read as a growing star trail alongside the rank name. */
export const AFFINITY_RANKS = [
  { min: 0, name: '幼鲸', emoji: '*' },
  { min: 25, name: '伙伴', emoji: '**' },
  { min: 50, name: '挚友', emoji: '***' },
  { min: 80, name: '深海羁绊', emoji: '****' },
] as const

/** Interaction tuning (all in points / ms). */
export interface AffinityConfig {
  /** Points per completed turn. */
  turnReward: number
  /** Points per pet; applied only outside the pet cooldown. */
  petReward: number
  /** Cooldown between pets, ms. */
  petCooldownMs: number
  /** Points per feed. */
  feedReward: number
  /** Cooldown between feeds, ms. */
  feedCooldownMs: number
  /** Wall-clock ms per companionship point (time-output growth). */
  timeRewardIntervalMs: number
  /** Points granted per elapsed time interval. */
  timeRewardPoints: number
}

export const defaultAffinityConfig: AffinityConfig = {
  turnReward: 1,
  petReward: 1,
  petCooldownMs: 10_000,
  feedReward: 5,
  feedCooldownMs: 30_000,
  timeRewardIntervalMs: 30 * 60_000,
  timeRewardPoints: 1,
}

export function emptyAffinity(): AffinityState {
  return { points: 0, lastPetAt: 0, lastFeedAt: 0, pets: 0, feeds: 0, turns: 0, lastTimeRewardAt: 0 }
}

/** Outcome of one interaction. */
export interface InteractionOutcome {
  /** Mutated affinity state (caller persists it). */
  affinity: AffinityState
  /** Points actually gained (0 when inside the cooldown). */
  delta: number
  /** Human-readable reaction copy the UI shows as a bubble. */
  reaction: string
  /** True when the interaction was accepted (outside cooldown). */
  accepted: boolean
}

/** Rank for a point total. */
export function rankOf(points: number): (typeof AFFINITY_RANKS)[number] {
  let rank: (typeof AFFINITY_RANKS)[number] = AFFINITY_RANKS[0]!
  for (const candidate of AFFINITY_RANKS) {
    if (points >= candidate.min) rank = candidate
  }
  return rank
}

function clamp(points: number): number {
  return Math.min(AFFINITY_MAX, Math.max(0, points))
}

/**
 * Apply one interaction to a copy of the state (immutable style: returns a
 * new object; the caller replaces the persisted state). Cooldowns only
 * apply once the pet has been interacted with at least once (last*At === 0
 * means "never", so the first pet/feed always lands).
 */
export function applyInteraction(
  state: AffinityState,
  kind: PetInteraction,
  nowMs: number,
  config: AffinityConfig = defaultAffinityConfig,
): InteractionOutcome {
  const next = { ...state }
  if (kind === 'pet') {
    if (state.lastPetAt !== 0 && nowMs - state.lastPetAt < config.petCooldownMs) {
      return { affinity: state, delta: 0, reaction: '唔…今天摸够啦，让人家歇口气嘛～', accepted: false }
    }
    next.lastPetAt = nowMs
    next.pets += 1
    next.points = clamp(state.points + config.petReward)
    return {
      affinity: next,
      delta: config.petReward,
      reaction: '呜哇，被摸头好幸福～再多摸摸人家嘛！',
      accepted: true,
    }
  }
  if (kind === 'feed') {
    if (state.lastFeedAt !== 0 && nowMs - state.lastFeedAt < config.feedCooldownMs) {
      return { affinity: state, delta: 0, reaction: '吃饱饱啦，肚子圆滚滚的，晚点再喂嘛～', accepted: false }
    }
    next.lastFeedAt = nowMs
    next.feeds += 1
    next.points = clamp(state.points + config.feedReward)
    return {
      affinity: next,
      delta: config.feedReward,
      reaction: '嗷呜！好香好甜，人家最爱你了！',
      accepted: true,
    }
  }
  return { affinity: state, delta: 0, reaction: '', accepted: false }
}

/** Reward one completed turn (called by the host on `done`). */
export function applyTurnReward(
  state: AffinityState,
  config: AffinityConfig = defaultAffinityConfig,
): AffinityState {
  const next = { ...state }
  next.turns += 1
  next.points = clamp(state.points + config.turnReward)
  return next
}

/**
 * Settle wall-clock companionship growth: every `timeRewardIntervalMs` of
 * elapsed time grants `timeRewardPoints` (the pet grows the longer you keep
 * DeepSeek in use). Lazy settlement like the treat clock — no timer, no
 * drift; the anchor starts at the first settlement (no backfill). Returns
 * the same object when nothing is due (callers skip persistence cheaply).
 */
export function settleTimeAffinity(
  state: AffinityState,
  nowMs: number,
  config: AffinityConfig = defaultAffinityConfig,
): AffinityState {
  const anchor = (state.lastTimeRewardAt ?? 0) === 0 ? nowMs : state.lastTimeRewardAt
  const periods = Math.floor(Math.max(0, nowMs - anchor) / config.timeRewardIntervalMs)
  if (periods <= 0) {
    return (state.lastTimeRewardAt ?? 0) === 0 ? { ...state, lastTimeRewardAt: nowMs } : state
  }
  return {
    ...state,
    points: clamp(state.points + periods * config.timeRewardPoints),
    lastTimeRewardAt: anchor + periods * config.timeRewardIntervalMs,
  }
}
