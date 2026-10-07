import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  AssistantStreamAccumulator, createMessage, createSystemMessage, createToolResultMessage, createUserMessage,
} from '@deepseek-ai/dsh-llm'
import type { AssistantStreamRecord, CallId, Message, StreamChunk, TimedStreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { apply, inject, resolveEstimatorConfig } from '../src/index.ts'
import { createLiveTokenUsageProjectionDefinition, estimateStreamTokens } from '../src/projection.ts'
import type { LiveTokenUsageProjection } from '../src/projection.ts'
import {
  estimateAssistantBlockTokens,
  estimateContentTokens,
  estimateMessageTokens,
  estimateTextBlockTokens,
  estimateToolCallBlockTokens,
} from '../src/estimator.ts'

afterEach(() => { vi.useRealTimers() })

async function harness(): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin({ inject, apply })
  return { ctx, session: ctx.sessions.create() }
}

function projected(ctx: Context, session: Session): LiveTokenUsageProjection {
  const value = ctx.sessionProjections.snapshot(session).values.liveTokenUsage
  if (value === undefined) throw new Error('liveTokenUsage projection is absent')
  return value
}

/**
 * rc.2 removed the `assistant/chunk` session event: a step's raw stream reaches
 * the log only as the compact record list embedded in its durable
 * `assistant/message` settlement. Tests therefore build a stream by feeding
 * timed chunks through the SDK's own accumulator and settle it with one
 * assistant message, which is exactly how the fold sees a real attempt.
 */
function chunksAt(startTime: number, chunks: readonly StreamChunk[], stepMs = 1): TimedStreamChunk[] {
  return chunks.map((chunk, index) => ({ time: startTime + index * stepMs, chunk }))
}

function streamOf(startTime: number, chunks: readonly StreamChunk[], stepMs = 1): AssistantStreamRecord[] {
  const accumulator = new AssistantStreamAccumulator()
  for (const timed of chunksAt(startTime, chunks, stepMs)) accumulator.push(timed)
  return accumulator.snapshot()
}

/** One settled attempt: its compact stream plus optional provider usage. */
function settlement(message: Message, stream: AssistantStreamRecord[], usage?: TokenUsage) {
  return {
    turn: 1,
    step: 1,
    message,
    stream,
    ...(usage === undefined ? {} : { usage }),
  }
}

function assistantMessage(content: Message['content'] = [{ type: 'text', text: 'ok' }]) {
  return createMessage({
    role: 'assistant',
    content,
    source: { kind: 'model', provider: 'mock', model: 'mock' },
  })
}

/** Append one settled attempt as a durable assistant message on the surface. */
function settleAttempt(
  session: Session,
  data: ReturnType<typeof settlement>,
  time?: number,
): SessionEvent {
  return session.append('assistant/message', data, { surfaceOp: 'append', ...(time === undefined ? {} : { time }) } as never)
}

describe('liveTokenUsage projection', () => {
  it('resolves configurable estimation parameters and rejects invalid values', () => {
    expect(resolveEstimatorConfig({
      charsPerToken: 2,
      blockOverhead: 1,
      roleOverhead: 3,
    })).toEqual({
      charsPerToken: 2,
      blockOverhead: 1,
      roleOverhead: 3,
    })
    expect(() => resolveEstimatorConfig({ charsPerToken: 0 })).toThrow('charsPerToken')
    expect(() => resolveEstimatorConfig({ blockOverhead: 0.5 })).toThrow('blockOverhead')
    expect(() => resolveEstimatorConfig({ unknown: 1 } as never)).toThrow('unknown config key')
  })

  it('updates input, output, and TPS per settled attempt, then accepts provider correction', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { ctx, session } = await harness()
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'abcd' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    // rc.2 moved the system prompt onto the surface: a `system/message` node
    // prices with the input estimate exactly like the retired header field did.
    session.append('system/message', {
      turn: 1,
      step: 1,
      message: createSystemMessage('abcd'),
    }, { surfaceOp: 'append' })
    session.append('request/header', {
      header: { config: { provider: 'mock', model: 'mock' } },
      reason: 'initial',
    })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 18,
      outputTokens: 0,
      estimated: true,
    })

    // A first attempt with no provider usage: its stream is priced
    // heuristically as one assembled text block (8 characters → 2 density
    // tokens, plus 4 block framing and 4 role framing = 10) and its own chunk
    // timeline measures the rate (10 tokens over one second).
    vi.setSystemTime(2_000)
    const estimate = streamOf(2_000, [
      { type: 'text-delta', index: 0, text: 'abcd' },
      { type: 'text-delta', index: 0, text: 'efgh' },
    ], 1_000)
    settleAttempt(session, settlement(assistantMessage(), estimate))
    expect(projected(ctx, session)).toMatchObject({
      outputTokens: 10,
      estimated: true,
      tokensPerSecond: 10,
    })

    // The provider's usage sample supersedes the estimate in place.
    vi.setSystemTime(4_000)
    settleAttempt(session, settlement(assistantMessage(), [
      ...estimate,
      { type: 'chunk', time: 4_000, chunk: { type: 'usage', usage: { inputTokens: 20, outputTokens: 30, cacheReadTokens: 80 } } },
    ], { inputTokens: 20, outputTokens: 30, cacheReadTokens: 80 }))
    expect(projected(ctx, session)).toEqual({
      uncachedInputTokens: 20,
      outputTokens: 30,
      cacheReadTokens: 80,
      cacheWriteTokens: 0,
      estimated: false,
      tokensPerSecond: 15,
    })

    // Settling with a positive elapsed window keeps the rate on the last row.
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(15)
  })

  it('keeps a usage-exact output exact against later output deltas', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(1_000, [{ type: 'text-delta', index: 0, text: 'abcd' }]),
    ))
    expect(projected(ctx, session)).toMatchObject({ estimated: true })

    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(2_000, [{ type: 'text-delta', index: 0, text: 'abcd' }]),
      { inputTokens: 5, outputTokens: 30 },
    ))
    expect(projected(ctx, session)).toMatchObject({ outputTokens: 30, estimated: false })

    // A trailing output delta after the exact usage must not re-estimate it.
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(3_000, [{ type: 'text-delta', index: 0, text: 'extra' }]),
    ))
    expect(projected(ctx, session)).toMatchObject({ outputTokens: 30, estimated: false })
  })

  it('keeps the last measured rate resident across rate-less steps', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    vi.setSystemTime(2_000)
    // 10 estimated tokens (8 characters → 2 density tokens, plus 4 block and
    // 4 role framing) over the stream's one-second window.
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(2_000, [
        { type: 'text-delta', index: 0, text: 'abcd' },
        { type: 'text-delta', index: 0, text: 'efgh' },
      ], 1_000),
    ))
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(10)

    // A new step before its first settlement keeps the last rate on the row.
    session.append('step/start', { turn: 2, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(10)

    // A step that settles without output does not erase it either.
    session.append('step/end', { turn: 2, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(10)
  })

  it('replaces same-step retry estimates and drops aborted estimates', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(1_000, [{ type: 'text-delta', index: 0, text: 'discarded' }]),
    ))
    session.append('step/end', { turn: 1, step: 1 })

    session.append('step/start', { turn: 1, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(2_000, [{ type: 'text-delta', index: 0, text: 'done' }]),
      { inputTokens: 20, outputTokens: 5, cacheReadTokens: 80 },
    ))
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 20,
      outputTokens: 5,
      cacheReadTokens: 80,
      estimated: false,
    })

    session.append('step/start', { turn: 2, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(3_000, [{ type: 'text-delta', index: 0, text: 'partial' }]),
    ))
    session.append('step/end', { turn: 2, step: 1 })
    session.append('turn/end', { turn: 2, reason: { kind: 'aborted', reason: { kind: 'user' } } })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 20,
      outputTokens: 5,
      cacheReadTokens: 80,
      estimated: false,
    })
  })

  it('prices every streaming chunk kind, including no-op deltas', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { ctx, session } = await harness()
    // A header arriving before any step only refreshes the stored header.
    session.append('request/header', {
      header: { config: { provider: 'mock', model: 'mock' } },
      reason: 'initial',
    })
    session.append('step/start', { turn: 1, step: 1 })
    // A header arriving mid-step refreshes the input estimate.
    session.append('request/header', {
      header: { config: { provider: 'mock', model: 'mock' } },
      reason: 'change',
    })
    // The full sweep of chunk kinds a step can stream, in the compact durable
    // form the settlement carries. Several slots are streamed in pieces, so the
    // assembled block prices once from its joined content, never per fragment.
    const stream = streamOf(1_000, [
      { type: 'reasoning-delta', index: 1, text: 'th' },
      { type: 'reasoning-delta', index: 1, text: 'ink' },
      // Empty deltas never create or extend blocks.
      { type: 'text-delta', index: 0, text: '' },
      { type: 'reasoning-delta', index: 1, text: '' },
      { type: 'tool-call-delta', index: 2, id: 'call_1' as CallId, argumentsDelta: '' },
      { type: 'tool-call-delta', index: 2, id: 'call_1' as CallId, name: 'bash', argumentsDelta: '{}' },
      // A nameless continuation extends the existing tool-call block.
      { type: 'tool-call-delta', index: 2, id: 'call_1' as CallId, argumentsDelta: ' more' },
      // A nameless delta on a fresh index prices with zero name characters.
      { type: 'tool-call-delta', index: 4, id: 'call_2' as CallId, argumentsDelta: 'x' },
      // Block-start chunks are inert for estimation.
      { type: 'block-start', index: 0, blockType: 'text' },
      // A settled block pins its exact estimate, superseding early deltas.
      { type: 'text-delta', index: 0, text: 'abcdefgh' },
      { type: 'text-delta', index: 0, text: 'ijkl' },
      { type: 'block-end', index: 0, block: { type: 'text', text: 'fixed' } },
      // A chunk landing past a gap leaves the gap blocks unpriced.
      { type: 'text-delta', index: 3, text: 'tail' },
    ])
    const spec = resolveEstimatorConfig({})
    // Assembled slots: index 0 pinned text 'fixed' → ceil(5/4) + 4 = 6;
    // index 1 reasoning 'think' (th + ink) → ceil(5/4) + 4 = 6; index 2 tool
    // call name 'bash' with arguments '{} more' → 1 + 2 + 4 = 7; index 3 text
    // 'tail' → 1 + 4 = 5; index 4 nameless arguments 'x' → 0 + 1 + 4 = 5. The
    // empty deltas never occupy a slot, and the two text slots at index 0
    // price once from their joined characters. Sum 29 plus one role overhead.
    expect(estimateStreamTokens(stream, spec)).toBe(33)

    settleAttempt(session, settlement(assistantMessage(), stream))
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 0,
      outputTokens: 33,
      estimated: true,
    })

    // Provider usage without cache-read reporting fills the buckets from scratch.
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(3_000, [{ type: 'usage', usage: { inputTokens: 7, outputTokens: 2 } }]),
      { inputTokens: 7, outputTokens: 2 },
    ))
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 7,
      outputTokens: 2,
      cacheReadTokens: 0,
      estimated: false,
    })

    // An assistant message without usage keeps the output-timing window open.
    vi.setSystemTime(2_000)
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(2_000, [{ type: 'text-delta', index: 0, text: 'settled' }]),
    ))
    expect(projected(ctx, session).outputTokens).toBeGreaterThan(0)  })

  it('settles zero-output steps without a rate and accepts zero-output usage', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 0,
      outputTokens: 0,
      estimated: true,
    })
    expect(projected(ctx, session).tokensPerSecond).toBeUndefined()

    session.append('step/start', { turn: 2, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(1_000, [{ type: 'usage', usage: { inputTokens: 5, outputTokens: 0, cacheReadTokens: 0 } }]),
      { inputTokens: 5, outputTokens: 0, cacheReadTokens: 0 },
    ))
    session.append('step/end', { turn: 2, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 5,
      outputTokens: 0,
      estimated: true,
    })
  })

  it('views during an active step, replacing same-step and keeping other-step estimates', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(1_000, [{ type: 'text-delta', index: 0, text: 'first' }]),
    ))
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).estimated).toBe(true)

    // A retry of the same step: the view replaces the settled estimate.
    session.append('step/start', { turn: 1, step: 1 })
    expect(projected(ctx, session)).toMatchObject({ estimated: true })
    settleAttempt(session, settlement(
      assistantMessage(),
      streamOf(2_000, [{ type: 'text-delta', index: 0, text: 'retry' }]),
    ))
    // rc.2 makes the durable assistant settlement itself a surface node (a
    // retry request carries the earlier assistant turn), so this step's input
    // estimate is the first attempt's assistant message: 'ok' prices to
    // ceil(2/4) + 4 block + 4 role = 9. The estimate flag still replaces the
    // same-step settled sample above.
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 9,
      estimated: true,
    })

    // A different-turn step keeps the settled totals visible underneath.
    session.append('step/start', { turn: 2, step: 1 })
    const during = projected(ctx, session)
    expect(during.estimated).toBe(true)
    expect(during.outputTokens).toBeGreaterThan(0)
  })
  it('settles an output-less assistant message without opening the timing window', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    // An attempt that streamed nothing: no block to price, so no rate either.
    settleAttempt(session, settlement(assistantMessage(), streamOf(1_000, [])))
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBeUndefined()
    expect(projected(ctx, session)).toMatchObject({ outputTokens: 0, estimated: true })
  })

  it('prices tool results and user messages on the surface', async () => {
    const { ctx, session } = await harness()
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: 'call_1' as CallId,
        content: [{ type: 'text', text: 'abcd' }],
        isError: false,
      }),
    }, { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'efgh' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    // rc.2 flattened message content: the retired nested `tool-result` block is
    // gone, so a tool result prices like any other message (text 'abcd' →
    // 1 density + 4 block + 4 role) and the user message like its own
    // ('efgh' → 1 + 4 + 4). 9 + 9 = 18.
    expect(projected(ctx, session).uncachedInputTokens).toBe(18)
  })

  it('prices system and developer messages on the widened surface', async () => {
    const { ctx, session } = await harness()
    session.append('system/message', {
      turn: 1,
      step: 1,
      message: createSystemMessage('abcd'),
    }, { surfaceOp: 'append' })
    session.append('developer/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'developer',
        content: [{ type: 'tool-removal', toolName: 'bash' }],
        source: { kind: 'user' },
      }),
    }, { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    const spec = resolveEstimatorConfig({})
    // rc.2 registered both as surface nodes; the fold prices them like any
    // other model-visible message (text density plus block and role framing).
    const system = estimateMessageTokens(createSystemMessage('abcd'), spec)
    const developer = estimateMessageTokens(createMessage({
      role: 'developer',
      content: [{ type: 'tool-removal', toolName: 'bash' }],
      source: { kind: 'user' },
    }), spec)
    expect(projected(ctx, session).uncachedInputTokens).toBe(system + developer)
  })

  it('replaces surface ranges and rejects invalid ranges', async () => {
    const { ctx, session } = await harness()
    const first = session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'one' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const second = session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'two' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'three' }],
      source: { kind: 'user' },
    }), {
      surfaceOp: { op: 'replace', startSeq: first.seq, endSeq: second.seq },
      sourceEventSeqs: [first.seq, second.seq],
    })
    session.append('step/start', { turn: 1, step: 1 })
    // One message (5 chars → 2 + 4 + 4): the replaced pair is gone.
    expect(projected(ctx, session).uncachedInputTokens).toBe(10)

    const definition = createLiveTokenUsageProjectionDefinition(resolveEstimatorConfig({}))
    let state = definition.init()
    const append = (text: string, surfaceOp: unknown): void => {
      state = definition.apply(state, {
        type: 'user/message',
        seq: 1,
        time: 1,
        data: createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'user' },
        }),
        surfaceOp,
      } as unknown as SessionEvent)
    }
    append('one', 'append')
    expect(() => { append('bad', { op: 'replace', startSeq: 5, endSeq: 2 }) }).toThrow('invalid current range')
  })

  it('prices a large sparse stream identically to a fresh full rescan', async () => {
    const { ctx, session } = await harness()
    // The defaults the harness fold resolves from resolveEstimatorConfig({}).
    const spec = { charsPerToken: 4, blockOverhead: 4, roleOverhead: 4 }
    session.append('step/start', { turn: 1, step: 1 })

    // Deterministic scripted mix: sparse indices up to ~2000, heavy index
    // reuse, kind switches on the same index, and every no-op delta shape.
    let seed = 0x2f6e2b1
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const textOf = (length: number): string => {
      let text = ''
      for (let i = 0; i < length; i++) text += CHARS[Math.floor(random() * CHARS.length)]
      return text
    }
    const NAMES = ['bash', 'read', 'write', 'search', 'code', 'tool']
    let lastIndex = 0
    let callId = 0
    const script: StreamChunk[] = []
    for (let eventIndex = 0; eventIndex < 3000; eventIndex++) {
      if (random() < 0.3) lastIndex = Math.floor(random() * 2000)
      const index = lastIndex
      const roll = random()
      if (roll < 0.3) {
        script.push({ type: 'text-delta', index, text: random() < 0.1 ? '' : textOf(1 + Math.floor(random() * 40)) })
      } else if (roll < 0.45) {
        script.push({ type: 'reasoning-delta', index, text: random() < 0.1 ? '' : textOf(1 + Math.floor(random() * 40)) })
      } else if (roll < 0.7) {
        const kind = random()
        script.push({
          type: 'tool-call-delta',
          index,
          id: `call_${callId++}` as CallId,
          ...(kind < 0.4 ? { name: NAMES[Math.floor(random() * NAMES.length)] } : {}),
          argumentsDelta: kind >= 0.2 && kind < 0.9 ? textOf(Math.floor(random() * 50)) : '',
        })
      } else if (roll < 0.75) {
        script.push({ type: 'block-start', index, blockType: 'text' })
      } else if (roll < 0.85) {
        script.push({ type: 'block-end', index, block: { type: 'text', text: textOf(Math.floor(random() * 20)) } })
      } else {
        script.push({ type: 'finish', reason: { kind: 'stop' } })
      }
    }

    // The fold prices the settlement's whole stream in one pass, which the
    // exported fold must agree with on this large sparse index space.
    const records = streamOf(1_000, script, 1)
    const expected = estimateStreamTokens(records, spec)
    expect(expected).toBeGreaterThan(0)

    settleAttempt(session, settlement(assistantMessage(), records))
    expect(projected(ctx, session).outputTokens).toBe(expected)

    // A second identical settlement re-derives the same price (nothing carried
    // over from the first attempt's estimate).
    settleAttempt(session, settlement(assistantMessage(), records))
    expect(projected(ctx, session).outputTokens).toBe(expected)
  })

  it('prices a settled block at its exact estimate and drops replaced surface seqs', () => {
    const spec = resolveEstimatorConfig({})

    // A settled block supersedes every delta that streamed for its slot, so the
    // stream price equals a fresh rescan with the same estimator formulas.
    const stream = streamOf(1_000, [
      { type: 'text-delta', index: 0, text: 'abcdefgh' },
      { type: 'block-end', index: 0, block: { type: 'text', text: 'fixed' } },
      { type: 'text-delta', index: 3, text: 'tail' },
      { type: 'tool-call-delta', index: 7, id: 'call_1' as CallId, name: 'bash', argumentsDelta: '{}' },
    ])
    const rescan = estimateAssistantBlockTokens(
      [estimateContentTokens([{ type: 'text', text: 'fixed' }], spec)]
        .concat([
          estimateTextBlockTokens('tail'.length, spec),
          estimateToolCallBlockTokens('bash'.length, '{}'.length, spec),
        ]),
      spec,
    )
    expect(estimateStreamTokens(stream, spec)).toBe(rescan)

    // Surface replaces drop the replaced seqs and keep only the new entry.
    const definition = createLiveTokenUsageProjectionDefinition(spec)
    const surfaceEvent = (seq: number, text: string, surfaceOp: unknown): SessionEvent => ({
      type: 'user/message',
      seq,
      time: 1,
      data: createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      }),
      surfaceOp,
    } as unknown as SessionEvent)
    let state = definition.init()
    state = definition.apply(state, surfaceEvent(1, 'one', 'append'))
    state = definition.apply(state, surfaceEvent(2, 'two', 'append'))
    state = definition.apply(state, surfaceEvent(3, 'three', { op: 'replace', startSeq: 1, endSeq: 2 }))
    expect(state.surface.has(1)).toBe(false)
    expect(state.surface.has(2)).toBe(false)
    expect(state.surface.has(3)).toBe(true)
    expect(state.surfaceTokens).toBe(estimateMessageTokens(
      createUserMessage({ content: [{ type: 'text', text: 'three' }], source: { kind: 'user' } }),
      spec,
    ))
    expect(() => definition.apply(state, surfaceEvent(4, 'bad', { op: 'replace', startSeq: 5, endSeq: 2 })))
      .toThrow('invalid current range')
    expect(() => definition.apply(state, surfaceEvent(4, 'bad', { op: 'replace', startSeq: 3, endSeq: 99 })))
      .toThrow('invalid current range')
  })
})
