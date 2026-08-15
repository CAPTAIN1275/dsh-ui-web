/**
 * Usage recorder — an invisible conversation-dock seat that watches the
 * `tokenUsage` projection and, whenever the cumulative total GROWS (a
 * response settled), uploads the current cumulative snapshot to the host.
 * The host stores the LATEST snapshot per session (replace semantics), so
 * repeated uploads overwrite instead of double counting; the upload fires
 * only on growth, so the host's calls counter tracks real response
 * completions rather than poll ticks.
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
 * The invisible recorder seat. Tracks the last seen cumulative total; when
 * the projection grows it uploads the current snapshot (debounced 1s).
 * @param props - framework runtime share.
 * @returns null (renders nothing).
 */
export const UsageRecorder = memo(function UsageRecorder(props: UsageRecorderProps): null {
  const session = props.useSession((s) => ({ sessionId: s.sessionId }))
  const usage = props.useProjection('tokenUsage') as TokenUsageProjection | undefined
  const lastTotalRef = useRef<number>(-1)
  const lastUploadRef = useRef<number>(0)

  useEffect(() => {
    const sid = session.sessionId
    if (sid === undefined || usage === undefined) return
    const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const prev = lastTotalRef.current
    // First sight: establish the baseline WITHOUT uploading. The projection
    // is a session-cumulative total that may already be large when this
    // component mounts (page refresh, session switch, HMR reload); uploading
    // it would make the host count the whole history as new usage. Only a
    // later GROWTH past the baseline is a real delta worth reporting.
    if (prev === -1) {
      lastTotalRef.current = total
      return
    }
    lastTotalRef.current = total
    if (total <= 0) return
    if (total <= prev) return
    const now = Date.now()
    if (now - lastUploadRef.current < 1000) return
    lastUploadRef.current = now
    void postSnapshot({
      sessionId: sid,
      model: currentModel,
      inputTokens: usage.uncachedInputTokens + usage.cacheReadTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
    })
  }, [session.sessionId, usage])

  return null
})
