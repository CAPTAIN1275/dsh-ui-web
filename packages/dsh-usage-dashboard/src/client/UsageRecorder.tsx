/**
 * Usage recorder — an invisible conversation-dock seat that watches the
 * `tokenUsage` projection and uploads per-response snapshots to the host.
 *
 * Semantics:
 *  - The projection is a session-cumulative total that may already be large
 *    when this component mounts (page refresh, session switch, HMR reload).
 *    The FIRST sight only establishes a baseline — never uploaded, so a
 *    mount never counts the whole history as new usage.
 *  - While the total GROWS (a response is streaming), uploads are debounced
 *    to one per second. When growth stops for SETTLE_MS, the recorder
 *    flushes one final snapshot — one completed response = one upload, so
 *    the host's calls counter tracks real response rounds.
 *  - The host stores the LATEST snapshot per session (replace semantics);
 *    repeated uploads overwrite instead of double counting.
 * @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
 */
import { memo, useEffect, useRef } from 'react'
import type {} from '@deepseek-ai/dsh-token-meter/client'

/** tokenUsage 投影值结构（与 full-stats 同源声明）。 */
interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Props injected by the conversation dock (framework runtime share). */
export interface UsageRecorderProps {
  useSession: <S>(selector: (s: { sessionId?: string }) => S) => S
  useProjection: <K extends string>(key: K) => unknown
}

/** 一轮响应结束判定的静默时长（ms）。 */
const SETTLE_MS = 2000

/** 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。 */
async function postSnapshot(snapshot: {
  sessionId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}): Promise<void> {
  try {
    await fetch('/api/usage/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...snapshot, ts: Date.now() }),
    })
  } catch {
    /* 上报失败静默：不打断对话 */
  }
}

/** 当前模型（由入口从连接层更新，尽力而为）。 */
let currentModel = 'unknown'

/** 供入口设置当前模型（连接层回调）。 */
export function setCurrentModel(model: string | undefined): void {
  if (typeof model === 'string' && model.length > 0) currentModel = model
}

/**
 * The invisible recorder seat.
 * @param props - framework runtime share.
 * @returns null (renders nothing).
 */
export const UsageRecorder = memo(function UsageRecorder(props: UsageRecorderProps): null {
  const session = props.useSession((s) => ({ sessionId: s.sessionId }))
  const usage = props.useProjection('tokenUsage') as TokenUsageProjection | undefined
  const lastTotalRef = useRef<number>(-1)
  const settleTimerRef = useRef<number | null>(null)
  const lastSeenRef = useRef<{ sessionId: string; input: number; output: number; cache: number } | null>(null)

  // Flush one snapshot after growth settles (a response completed).
  const flush = (): void => {
    settleTimerRef.current = null
    const seen = lastSeenRef.current
    if (seen === null) return
    void postSnapshot({
      sessionId: seen.sessionId,
      model: currentModel,
      inputTokens: seen.input,
      outputTokens: seen.output,
      cacheReadTokens: seen.cache,
    })
  }

  useEffect(() => {
    const sid = session.sessionId
    if (sid === undefined || usage === undefined) return
    const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const prev = lastTotalRef.current
    if (prev === -1) {
      // Baseline only — never upload a pre-existing cumulative total.
      lastTotalRef.current = total
      return
    }
    lastTotalRef.current = total
    if (total <= 0) return
    if (total <= prev) return
    // Growth observed: remember the latest snapshot and (re)arm the settle
    // timer. Debounce 1s of streaming growth, then flush once settled.
    lastSeenRef.current = {
      sessionId: sid,
      input: usage.uncachedInputTokens + usage.cacheReadTokens,
      output: usage.outputTokens,
      cache: usage.cacheReadTokens,
    }
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(flush, SETTLE_MS)
  }, [session.sessionId, usage])

  // Session switch: flush anything pending, reset the baseline.
  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [])

  return null
})
