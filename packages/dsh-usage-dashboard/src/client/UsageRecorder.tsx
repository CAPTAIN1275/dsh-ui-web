/**
 * Usage recorder — an invisible conversation-dock seat that watches the
 * `tokenUsage` projection and POSTs per-response deltas to the host
 * `/api/usage/record` endpoint. Rendering nothing itself; the colorful
 * dashboard is a separate sidebar entry.
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

/** 上报一条用量记录到宿主。 */
async function postRecord(record: {
  sessionId: string
  sessionTitle: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}): Promise<void> {
  try {
    await fetch('/api/usage/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...record, ts: Date.now() }),
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
 * The invisible recorder seat. Compares the tokenUsage projection against
 * the last reported value; on growth (a response settled) it uploads the
 * delta. Runs only while a session is active.
 * @param props - framework runtime share.
 * @returns null (renders nothing).
 */
export const UsageRecorder = memo(function UsageRecorder(props: UsageRecorderProps): null {
  const session = props.useSession((s) => ({ sessionId: s.sessionId }))
  const usage = props.useProjection('tokenUsage') as TokenUsageProjection | undefined
  const lastRef = useRef<TokenUsageProjection | null>(null)
  const lastUploadRef = useRef<number>(0)

  useEffect(() => {
    if (session.sessionId === undefined || usage === undefined) return
    const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const prev = lastRef.current
    lastRef.current = usage
    if (prev === null || total <= 0) return
    // Only upload when the total grew (a new response completed); the host
    // dedupes by ignoring zero/negative deltas.
    const prevTotal = prev.uncachedInputTokens + prev.outputTokens + prev.cacheReadTokens + prev.cacheWriteTokens
    if (total <= prevTotal) return
    const now = Date.now()
    // Debounce: at most one upload per 5s to avoid bursts mid-stream.
    if (now - lastUploadRef.current < 5000) return
    lastUploadRef.current = now
    const input = usage.uncachedInputTokens + usage.cacheReadTokens
    void postRecord({
      sessionId: session.sessionId,
      sessionTitle: '',
      model: currentModel,
      inputTokens: input - (prev.uncachedInputTokens + prev.cacheReadTokens),
      outputTokens: usage.outputTokens - prev.outputTokens,
      cacheReadTokens: usage.cacheReadTokens - prev.cacheReadTokens,
    })
  }, [session.sessionId, usage])

  return null
})
