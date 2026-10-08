import { z } from 'zod'
// Type-only: pulls the session-projection map table (merge-extensible) so the
// liveTokenUsage projection key registers against it (augmentation lives in
// @deepseek-ai/dsh-token-meter/projection).
import type {
  SessionProjectionMap,
  SessionProjectionStateMap,
} from '@deepseek-ai/dsh-session-projection/types'
// Loads the local map-table augmentation (src/types/token-meter.d.ts) into
// this program; without a real reference the type-only import is elided and
// the augmentation is never applied.
import type {
  LiveTokenUsageProjection,
  TokenUsageProjection,
} from '@deepseek-ai/dsh-token-meter/client'
import type {} from './types/token-meter.d.ts'
import type { AssistantStreamRecord, Message, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { expandAssistantStream, assistantStreamFirstTokenTime } from '@deepseek-ai/dsh-llm'
import type { EpochHeader, SessionEvent, SurfaceEvent } from '@deepseek-ai/dsh-session'
import { isSurfaceEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import {
  estimateAssistantBlockTokens,
  estimateContentTokens,
  estimateHeaderTokens,
  estimateMessageTokens,
  estimateTextBlockTokens,
  estimateToolCallBlockTokens,
} from './estimator.ts'
import type { EstimatorSpec } from './estimator.ts'

export type { LiveTokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'

const zeroBuckets = (): TokenUsageProjection => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

const bucketsFrom = (usage: TokenUsage): TokenUsageProjection => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
})

const addReplacing = (
  totals: TokenUsageProjection,
  previous: TokenUsageProjection | undefined,
  next: TokenUsageProjection,
): TokenUsageProjection => ({
  uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
  outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
  cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
  cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
})

const projectionSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
  tokensPerSecond: z.number().nonnegative().optional(),
}).strict() as unknown as z.ZodType<LiveTokenUsageProjection>

/** One settled attempt's output priced from its durable stream. */
interface StepOutput {
  /** Estimated output tokens, or the provider's exact count when reported. */
  tokens: number
  /** True when no provider usage sample replaced the estimate. */
  estimated: boolean
  /** Measured throughput, present only with a positive decode window. */
  tokensPerSecond?: number
}

interface ActiveStep {
  turn: number
  step: number
  buckets: TokenUsageProjection
  exact: boolean
  /** First output time of the current estimate, used for its throughput window. */
  firstOutputTime?: number
  /** Latest output time of the current estimate. */
  latestOutputTime?: number
}

interface SettledSample {
  turn: number
  step: number
  buckets: TokenUsageProjection
  estimated: boolean
  /** Last measured throughput; carried across rate-less steps. */
  tokensPerSecond: number | undefined
}

export interface State {
  settled: TokenUsageProjection
  settledEstimates: number
  last: SettledSample | null
  /**
   * Surface seq -> estimated tokens, in MODEL-VISIBLE (surface) order: the
   * iteration order is the surface order, which a positional replacement can
   * put out of seq order (its node lands where the shadowed range started).
   */
  surface: Map<number, number>
  surfaceTokens: number
  header: EpochHeader | undefined
  active: ActiveStep | null
}

/**
 * The model-visible message one surface event contributes to the surface.
 *
 * rc.2 widened the surface to five message-producing types (system, developer,
 * user, assistant, and tool result); each projects its message verbatim, which
 * is exactly what the derived request history carries.
 * @param event - one committed surface event.
 * @returns the message that event places on the surface.
 */
function surfaceMessage(event: SurfaceEvent): Message {
  switch (event.type) {
    case 'developer/message':
    case 'system/message':
    case 'assistant/message':
      return event.data.message
    case 'tool/result':
      return event.data.message
    case 'user/message':
      return event.data
  }
}

function applySurface(
  state: State,
  event: SurfaceEvent,
  spec: EstimatorSpec,
): Pick<State, 'surface' | 'surfaceTokens'> {
  const tokens = estimateMessageTokens(surfaceMessage(event), spec)
  if (event.surfaceOp === 'append') {
    state.surface.set(event.seq, tokens)
    return {
      surface: state.surface,
      surfaceTokens: state.surfaceTokens + tokens,
    }
  }
  const operation = event.surfaceOp
  // The declared range is POSITIONAL, not numeric: it runs between the two
  // nodes' positions in surface order, exactly as the canonical fold resolves
  // it (`@deepseek-ai/dsh-session`'s `replacementRange` uses indexOf over the
  // node list) and as the type docs state ("replaces surface nodes from
  // startSeq (inclusive) through endSeq (inclusive)"; startSeq === endSeq
  // replaces a single node). A replacement inserts its own node at the
  // shadowed range's start position, so a node with a larger seq can sit
  // BEFORE one with a smaller seq after the first replacement; comparing seq
  // numbers, or sweeping the numeric interval between them, then removes
  // nodes the surface keeps and keeps nodes it drops. The Map is maintained
  // in surface order (appends extend the tail, a replacement rebuilds it), so
  // positions are read by iterating it.
  let startIndex = -1
  let endIndex = -1
  let position = 0
  for (const seq of state.surface.keys()) {
    if (seq === operation.startSeq) startIndex = position
    if (seq === operation.endSeq) endIndex = position
    if (startIndex !== -1 && endIndex !== -1) break
    position++
  }
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    throw new Error(
      'live-stats: replace at seq ' + event.seq + ' has invalid current range '
      + operation.startSeq + '-' + operation.endSeq,
    )
  }
  // Rebuild the surface in place but in surface order: every node before the
  // range, the replacement at the range's start position, then the nodes after
  // it. Storing the replacement by splice position (not by insertion at the
  // Map tail) is what keeps later positional ranges resolvable.
  const next = new Map<number, number>()
  let removed = 0
  position = 0
  for (const [seq, nodeTokens] of state.surface) {
    if (position === startIndex) next.set(event.seq, tokens)
    if (position >= startIndex && position <= endIndex) removed += nodeTokens
    else next.set(seq, nodeTokens)
    position++
  }
  return {
    surface: next,
    surfaceTokens: state.surfaceTokens - removed + tokens,
  }
}

/** Slot key of one streamed block: the block index the deltas claimed. */
type SlotKey = string | number

/** Final assembled content of one occupied block slot. */
type OutputBlock =
  | { kind: 'text'; characters: number }
  | { kind: 'reasoning'; characters: number }
  | { kind: 'tool-call'; nameCharacters: number; argumentCharacters: number }
  | { kind: 'fixed'; tokens: number }

/** Price one assembled block slot with the shared estimator formulas. */
function priceOutputBlock(block: OutputBlock, spec: EstimatorSpec): number {
  switch (block.kind) {
    case 'text':
    case 'reasoning':
      return estimateTextBlockTokens(block.characters, spec)
    case 'tool-call':
      return estimateToolCallBlockTokens(block.nameCharacters, block.argumentCharacters, spec)
    case 'fixed':
      return block.tokens
  }
}

/**
 * Price one settled attempt's stream under the configured density.
 *
 * Deltas are assembled per block slot exactly as the stream's own assembler
 * concatenates them: a delta extends the slot's accumulated content, a
 * kind switch on an occupied slot restarts it, and a `block-end` pins the
 * structural price of the assembled block. Occupied slots then price once
 * each, so the result equals a full rescan with the same formulas — pricing
 * every delta's fragment separately would re-ceil the density per fragment
 * and overprice a block streamed in many small pieces.
 * @param stream - the settled attempt's compact stream records.
 * @param spec - resolved estimator settings.
 * @returns the estimated output tokens (zero for a stream with no content).
 */
export function estimateStreamTokens(
  stream: readonly AssistantStreamRecord[],
  spec: EstimatorSpec,
): number {
  const blocks = new Map<SlotKey, OutputBlock>()
  for (const { chunk } of expandAssistantStream(stream)) {
    switch (chunk.type) {
      case 'text-delta': {
        if (chunk.text === '') break
        const previous = blocks.get(chunk.index)
        blocks.set(chunk.index, {
          kind: 'text',
          characters: (previous?.kind === 'text' ? previous.characters : 0) + chunk.text.length,
        })
        break
      }
      case 'reasoning-delta': {
        if (chunk.text === '') break
        const previous = blocks.get(chunk.index)
        blocks.set(chunk.index, {
          kind: 'reasoning',
          characters: (previous?.kind === 'reasoning' ? previous.characters : 0) + chunk.text.length,
        })
        break
      }
      case 'tool-call-delta': {
        if (chunk.name === undefined && chunk.argumentsDelta === '') break
        const previous = blocks.get(chunk.index)
        blocks.set(chunk.index, {
          kind: 'tool-call',
          nameCharacters: chunk.name?.length
            ?? (previous?.kind === 'tool-call' ? previous.nameCharacters : 0),
          argumentCharacters: (previous?.kind === 'tool-call' ? previous.argumentCharacters : 0)
            + chunk.argumentsDelta.length,
        })
        break
      }
      case 'block-end':
        // A settled block supersedes every delta that streamed for its slot.
        blocks.set(chunk.index, { kind: 'fixed', tokens: estimateContentTokens([chunk.block], spec) })
        break
      default:
        break
    }
  }
  return estimateAssistantBlockTokens(
    [...blocks.values()].map(block => priceOutputBlock(block, spec)),
    spec,
  )
}

/** Timestamp of the last streamed chunk, read from the record timeline.
 * Packed runs carry the time of their first member plus per-member deltas, so
 * the last member's time is the run anchor plus every delta.
 * @param stream - the settled attempt's compact stream records.
 * @returns the last chunk time, or undefined for an empty stream.
 */
function lastStreamTime(stream: readonly AssistantStreamRecord[]): number | undefined {
  let last: number | undefined
  for (const record of stream) {
    const time = record.type === 'chunk'
      ? record.time
      : record.time0 + record.dt.reduce((sum, delta) => sum + delta, 0)
    if (last === undefined || time > last) last = time
  }
  return last
}

/**
 * Price one settled attempt's stream and measure its throughput.
 *
 * rc.2 removed the `assistant/chunk` session event: a step's raw stream now
 * reaches the log only as the compact record list embedded in its durable
 * `assistant/message` settlement, so output is priced from that whole stream in
 * one pass instead of incrementally per delta. The stream carries the timestamp
 * of every chunk, so the rate is re-derived from the log's own timeline rather
 * than from when the fold happened to observe the event.
 * @param stream - the settled attempt's compact stream records.
 * @param eventTime - the settlement's own session-event timestamp.
 * @param usage - provider usage carried by the settlement, when reported.
 * @param spec - resolved estimator settings.
 * @returns the step's output tokens, estimate flag, and the measured rate.
 */
function priceStream(
  stream: readonly AssistantStreamRecord[],
  eventTime: number,
  usage: TokenUsage | undefined,
  spec: EstimatorSpec,
): StepOutput {
  const tokens = estimateStreamTokens(stream, spec)
  const started = assistantStreamFirstTokenTime(stream)
  const latest = lastStreamTime(stream) ?? eventTime
  const elapsedMs = started === undefined ? 0 : latest - started
  const outputTokens = usage?.outputTokens ?? tokens
  return {
    tokens: outputTokens,
    estimated: usage === undefined,
    ...(started === undefined || elapsedMs <= 0 || outputTokens <= 0
      ? {}
      : { tokensPerSecond: outputTokens * 1_000 / elapsedMs }),
  }
}

/**
 * Open the active step's output window from the pace one settled attempt
 * measured. Only the rate is carried: the next settlement re-derives its own
 * token count, so no estimate from this attempt survives into it.
 * @param active - the active step to refresh.
 * @param output - the attempt's priced output and measured rate.
 * @param time - the settlement's session-event timestamp.
 * @param usage - the usage sample that made the attempt exact.
 * @returns the next active step.
 */
function openOutputWindow(
  active: ActiveStep,
  output: StepOutput,
  time: number,
  usage: TokenUsage,
): ActiveStep {
  const step: ActiveStep = {
    ...active,
    buckets: bucketsFrom(usage),
    exact: true,
  }
  if (usage.outputTokens <= 0) return { ...step, firstOutputTime: undefined, latestOutputTime: undefined }
  const windowMs = output.tokensPerSecond === undefined
    ? 0
    : output.tokens * 1_000 / output.tokensPerSecond
  return { ...step, firstOutputTime: time - windowMs, latestOutputTime: time }
}

function view(state: State): LiveTokenUsageProjection {
  const active = state.active
  const previous = active !== null
    && state.last?.turn === active.turn
    && state.last.step === active.step
    ? state.last
    : undefined
  const buckets = active === null
    ? state.settled
    : addReplacing(state.settled, previous?.buckets, active.buckets)
  const estimates = state.settledEstimates
    - (previous?.estimated === true ? 1 : 0)
    + (active !== null && !active.exact ? 1 : 0)
  // Resident throughput: once any step measured a rate, keep reporting it.
  // Without the fallback the row drops out between output bursts (an active
  // step before its settlement) and after a rate-less step settles — the
  // stats band must not flicker while the other groups stay put.
  const rate = active === null
    ? state.last?.tokensPerSecond
    : rateOfActive(active) ?? state.last?.tokensPerSecond
  return {
    ...buckets,
    estimated: estimates > 0,
    ...(rate === undefined ? {} : { tokensPerSecond: rate }),
  }
}

/** Throughput of the active step's estimate, or undefined without a window. */
function rateOfActive(step: ActiveStep): number | undefined {
  if (step.firstOutputTime === undefined || step.latestOutputTime === undefined) return
  const elapsedMs = step.latestOutputTime - step.firstOutputTime
  if (elapsedMs <= 0 || step.buckets.outputTokens <= 0) return
  return step.buckets.outputTokens * 1_000 / elapsedMs
}

/** Create the replayable live usage projection consumed by DSH Web and the TPS row.
 * @param spec - resolved estimator settings for the fold.
 * @returns the replayable `liveTokenUsage` projection definition.
 */
/**
 * The map-table entries this unit owns, re-read through the augmented rc.2
 * tables so the register overloads see the same symbol identity (the
 * type-only imports above load the augmentation).
 */
export type LiveTokenUsageStateMapEntry = SessionProjectionStateMap['liveTokenUsage']

export function createLiveTokenUsageProjectionDefinition(
  spec: EstimatorSpec,
): ProjectionDefinition<'liveTokenUsage', State> {
  return {
    key: 'liveTokenUsage',
    // rc.2 renames `schema` to `stateSchema` and parses it on persisted-state
    // restore. The fold state is in-memory only (surface is a Map, not JSON),
    // so the strict wire schema validates the served view and the state
    // schema is a permissive passthrough.
    stateSchema: z.any() as unknown as z.ZodType<State>,
    init: () => ({
      settled: zeroBuckets(),
      settledEstimates: 0,
      last: null,
      surface: new Map(),
      surfaceTokens: 0,
      header: undefined,
      active: null,
    }),
    apply: (state: State, event: SessionEvent) => {
      let next = state
      if (event.type === 'step/start') {
        next = {
          ...next,
          active: {
            turn: event.data.turn,
            step: event.data.step,
            buckets: {
              ...zeroBuckets(),
              uncachedInputTokens: estimateHeaderTokens(state.header, spec) + state.surfaceTokens,
            },
            exact: false,
          },
        }
      } else if (event.type === 'request/header') {
        next = {
          ...next,
          header: event.data.header,
          ...(next.active === null ? {} : {
            active: {
              ...next.active,
              buckets: {
                ...next.active.buckets,
                uncachedInputTokens: estimateHeaderTokens(event.data.header, spec) + state.surfaceTokens,
              },
            },
          }),
        }
      } else if (event.type === 'assistant/message') {
        const output = priceStream(event.data.stream, event.time, event.data.usage, spec)
        if (next.active === null) {
          // A settlement outside an open step (a resumed or forked tail) has no
          // step to price; the surface fold below still records its message.
        } else if (event.data.usage === undefined) {
          if (next.active.exact) {
            // The provider's count owns an exact step: a usage-less settlement
            // is only one more estimate, so it may extend the output window but
            // must never replace the exact buckets or clear the exact flag.
            next = {
              ...next,
              active: {
                ...next.active,
                ...(next.active.buckets.outputTokens > 0 ? { latestOutputTime: event.time } : {}),
              },
            }
          } else {
            // An estimate owns the step until a settlement reports usage: the
            // window opens at this settlement's time and spans the rate measured
            // from the stream's own timeline.
            const windowMs = output.tokensPerSecond === undefined
              ? 0
              : output.tokens * 1_000 / output.tokensPerSecond
            next = {
              ...next,
              active: {
                ...next.active,
                exact: false,
                buckets: { ...next.active.buckets, outputTokens: output.tokens },
                ...(output.tokens > 0
                  ? { firstOutputTime: event.time - windowMs, latestOutputTime: event.time }
                  : {}),
              },
            }
          }
        } else {
          next = {
            ...next,
            active: openOutputWindow(next.active, output, event.time, event.data.usage),
          }
        }
      } else if (event.type === 'step/end' && next.active !== null) {
        const active = next.active
        const rate = rateOfActive(active)
        const previous = next.last?.turn === active.turn && next.last.step === active.step
          ? next.last
          : undefined
        next = {
          ...next,
          settled: addReplacing(next.settled, previous?.buckets, active.buckets),
          settledEstimates: next.settledEstimates
          - (previous?.estimated === true ? 1 : 0)
          + (!active.exact ? 1 : 0),
          last: {
            turn: active.turn,
            step: active.step,
            buckets: active.buckets,
            estimated: !active.exact,
            // Carry the last measured rate across a rate-less step instead of
            // clobbering it: the row stays resident (see view()).
            tokensPerSecond: rate ?? state.last?.tokensPerSecond,
          },
          active: null,
        }
      } else if (event.type === 'turn/end'
      && event.data.reason.kind !== 'completed'
      && next.last?.turn === event.data.turn
      && next.last.estimated) {
        next = {
          ...next,
          settled: addReplacing(next.settled, next.last.buckets, zeroBuckets()),
          settledEstimates: next.settledEstimates - 1,
          last: null,
        }
      }

      if (isSurfaceEvent(event)) next = { ...next, ...applySurface(next, event, spec) }
      return next
    },
    stateVersion: 2,
    // rc.2: snapshot() only surfaces units with a wire view; without it the
    // projection registers host-only and the live TPS row reads nothing.
    wire: {
      viewSchema: projectionSchema,
      view: (state: State): LiveTokenUsageProjection => view(state),
    },
  }
}
