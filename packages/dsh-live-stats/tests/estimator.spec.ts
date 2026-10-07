import { describe, expect, it } from 'vitest'
import { createMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  estimateAssistantBlockTokens,
  estimateContentTokens,
  estimateHeaderTokens,
  estimateMessageTokens,
  estimateTextBlockTokens,
  estimateToolCallBlockTokens,
  resolveEstimatorConfig,
} from '../src/estimator.ts'

const SPEC = resolveEstimatorConfig({})

describe('live-stats estimator', () => {
  it('rejects non-finite density and negative or fractional overheads', () => {
    expect(() => resolveEstimatorConfig({ charsPerToken: Number.NaN })).toThrow('charsPerToken')
    expect(() => resolveEstimatorConfig({ charsPerToken: Infinity })).toThrow('charsPerToken')
    expect(() => resolveEstimatorConfig({ blockOverhead: -1 })).toThrow('blockOverhead')
    expect(() => resolveEstimatorConfig({ roleOverhead: -2 })).toThrow('roleOverhead')
  })

  it('prices every block kind and message/header framing', () => {
    // Empty assistant block list carries no role overhead.
    expect(estimateAssistantBlockTokens([], SPEC)).toBe(0)
    // Text and reasoning share the character density plus block overhead.
    expect(estimateTextBlockTokens(4, SPEC)).toBe(5)
    expect(estimateContentTokens([{ type: 'reasoning', text: 'abcd' }], SPEC)).toBe(5)
    // Tool calls price name and arguments separately.
    expect(estimateToolCallBlockTokens(4, 8, SPEC)).toBe(7)
    expect(estimateContentTokens([
      { type: 'tool-call', id: 'call_1' as never, name: 'tool', arguments: '{}' },
    ], SPEC)).toBe(6)
    // rc.2 dropped the nested `tool-result` content block: a tool result is a
    // message whose blocks are ordinary ones, priced at their own density plus
    // one block frame (1 + 4).
    expect(estimateContentTokens([{ type: 'text', text: 'abcd' }], SPEC)).toBe(5)
    // Content kinds with no text arm of their own price structurally, matching
    // the fallback they shared before the flat-content change.
    expect(estimateContentTokens([
      { type: 'tool-addition', toolName: 'bash' },
    ], SPEC)).toBe(SPEC.blockOverhead + Math.ceil(JSON.stringify({ type: 'tool-addition', toolName: 'bash' }).length / 4))
    expect(estimateContentTokens([
      { type: 'tool-removal', toolName: 'bash' },
    ], SPEC)).toBe(SPEC.blockOverhead + Math.ceil(JSON.stringify({ type: 'tool-removal', toolName: 'bash' }).length / 4))
    // Unknown blocks fall back to JSON sizing.
    expect(estimateContentTokens([{ type: 'mystery' } as never], SPEC)).toBe(9)
    // Message role framing applies on top of the content price.
    expect(estimateMessageTokens(createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      source: { kind: 'model', provider: 'mock', model: 'mock' },
    }), SPEC)).toBe(9)
    // User messages price the same way.
    expect(estimateMessageTokens(createUserMessage({
      content: [{ type: 'text', text: 'ok' }],
      source: { kind: 'user' },
    }), SPEC)).toBe(9)
  })

  it('prices the flat content of a tool-result message without recursing', () => {
    // A tool result's own blocks are priced flat; the old nested-content
    // recursion has no counterpart in the rc.2 message shape.
    const message = createToolResultMessage({
      callId: 'call_1' as never,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    })
    expect(estimateMessageTokens(message, SPEC)).toBe(9)
    // A deeply nested value supplied by a merge-extended block kind is priced
    // structurally at JSON size rather than walked.
    let nested: unknown = { type: 'text', text: 'x' }
    for (let depth = 0; depth < 1_000; depth++) nested = { type: 'mystery', nested }
    expect(() => estimateContentTokens([nested as never], SPEC)).not.toThrow()
  })

  it('prices header framing for system text and tool schemas', () => {
    expect(estimateHeaderTokens(undefined, SPEC)).toBe(0)
    expect(estimateHeaderTokens({
      config: { provider: 'mock', model: 'mock' },
      system: 'abcd',
    }, SPEC)).toBe(5)
    expect(estimateHeaderTokens({
      config: { provider: 'mock', model: 'mock' },
      tools: [{ name: 'tool', description: 'd', parameters: {} }],
    }, SPEC)).toBe(17)
    expect(estimateHeaderTokens({
      config: { provider: 'mock', model: 'mock' },
      tools: [],
    }, SPEC)).toBe(0)
  })
})
