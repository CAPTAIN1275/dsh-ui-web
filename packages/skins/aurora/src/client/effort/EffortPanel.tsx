/**
 * aurora Effort panel — 1:1 port of the reference EffortCard (glow border,
 * gradient card, Easy/Intense scale labels, WebGL fire track, glowing thumb,
 * drag point-light). Clicking the「推理等级」row in the official model menu
 * opens this panel instead of the level list; the slider is continuous while
 * dragging and snaps to the nearest effort level on release.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { useWebglFire } from './useWebglFire.ts'
import css from './effort.module.css'

/** Panel props: owning session, wire face, close verb. */
export interface EffortPanelProps {
  sessionId: string
  connection: ConnectionHandle
  onClose: () => void
}

/** One reasoning level as returned by the directory API. */
interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** The advisory directory value (`sessions.models` response). */
interface DirectoryValue {
  current: { provider: string; model: string; reasoningEffort?: string } | null
  groups: Array<{
    id: string
    models: Array<{
      id: string
      reasoning?: { efforts?: EffortLevel[]; defaultEffort?: string }
    }>
  }>
}

/** Panel width (must match the CSS `.panel` width). */
const PANEL_W = 280

/** Load the per-session model directory once per panel open. */
function useDirectory(connection: ConnectionHandle, sessionId: string): DirectoryValue | null {
  const [directory, setDirectory] = useState<DirectoryValue | null>(null)

  useEffect(() => {
    let alive = true
    setDirectory(null)
    void connection.api.sessions
      .models({ sessionId })
      .then((response) => {
        const value = response.result.ok ? response.result.value : null
        console.log('[aurora-effort] models:', response.result.ok
          ? `ok groups=${value?.groups?.length} current=${JSON.stringify(value?.current)}`
          : `fail ${response.result.error?.code}: ${response.result.error?.message}`)
        if (alive && response.result.ok) setDirectory(response.result.value)
      })
      .catch((error) => {
        console.warn('[aurora-effort] models threw:', error)
      })
    return () => {
      alive = false
    }
  }, [connection, sessionId])

  return directory
}

/**
 * The floating effort card.
 * @param props - session + wire face + close verb.
 */
export function EffortPanel(props: EffortPanelProps): ReactElement {
  const { sessionId, connection, onClose } = props
  const directory = useDirectory(connection, sessionId)
  const [dragging, setDragging] = useState(false)
  // Continuous 0..100 slider position; snaps to an effort level on release.
  const [rawValue, setRawValue] = useState(0)

  const disabled = directory === null
  const rawCurrent = directory?.current ?? null
  // 无 current 时回退到第一个分组的第一模型（目录数据总是可用的）。
  const fallback = directory !== null && directory.groups.length > 0 && directory.groups[0].models.length > 0
    ? { provider: directory.groups[0].id, model: directory.groups[0].models[0].id }
    : null
  const current = rawCurrent ?? fallback
  const group = current === null ? undefined : directory?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  const efforts = model?.reasoning?.efforts ?? []
  const usable = !disabled && current !== null && efforts.length >= 2

  const currentEffortId = current?.reasoningEffort ?? model?.reasoning?.defaultEffort
  const rawIndex = currentEffortId === undefined ? -1 : efforts.findIndex((level) => level.id === currentEffortId)
  const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100
  const initialRaw = usable && rawIndex >= 0 ? rawIndex * step100 : 0

  useEffect(() => {
    setRawValue(initialRaw)
    setDragging(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory])

  const displayIndex = usable ? Math.round(rawValue / step100) : 0
  const level = efforts[displayIndex]
  const slider100 = usable ? rawValue : 0
  // 火焰前缘保底可见（最低档也有火苗，拖动时跟随滑块）。
  const slider01 = usable ? 0.15 + (rawValue / 100) * 0.85 : 0

  // WebGL fire: the front edge follows the slider; the CSS mask reveals it.
  const fireRef = useRef<HTMLCanvasElement | null>(null)
  useWebglFire(fireRef, () => slider01, () => true)

  const maskP = Math.max(slider100 - 1.5, 0)
  const maskFade = Math.min(slider100 + 1.5, 100)
  const fireStyle: React.CSSProperties = usable
    ? {
        maskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
        WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
        opacity: 1,
      }
    : { opacity: 0 }

  const pointLightStyle: React.CSSProperties = {
    left: `${22 + (slider100 / 100) * (PANEL_W - 44)}px`,
    top: '76px',
  }

  /** 写入当前档位到会话（供拖动中节流调用）。 */
  const writeEffort = (v: number): void => {
    if (!usable || current === null) return
    const idx = Math.round(v / step100)
    const effort = efforts[idx]
    if (effort === undefined) return
    void connection.api.sessions
      .selectModel({
        sessionId,
        provider: current.provider,
        model: current.model,
        reasoningEffort: effort.id,
      })
      .catch(() => {
        /* the official picker keeps its own error surface */
      })
  }
  const lastWriteRef = useRef(0)

  const onInput = (event: React.FormEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    setRawValue(v)
    // 每帧最多一次写入，避免拖动中请求堆积造成尾部延迟。
    const now = performance.now()
    if (now - lastWriteRef.current >= 16) {
      lastWriteRef.current = now
      writeEffort(v)
    }
  }

  /** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
  const commit = (event: React.SyntheticEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    const idx = Math.round(v / step100)
    setRawValue(idx * step100)
    setDragging(false)
    writeEffort(v)
  }

  return (
    <div className={css.panel} data-effort-panel="true">
      <div className={css.glow} />
      <div className={css.inner}>
        <div className={css.head}>
          <div className={css.headLeft}>
            <span className={css.labelText}>Effort</span>
            {usable && level !== undefined ? (
              <span
                key={level.name}
                className={`${css.status} ${css[`level${displayIndex}`] ?? ''} ${displayIndex === efforts.length - 1 ? css.statusGlow : ''}`}
              >
                {level.name}
              </span>
            ) : (
              <span className={css.status}>—</span>
            )}
          </div>
          <button type="button" className={css.close} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className={css.levelLabels}>
          {efforts.map((entry, labelIndex) => (
            <span
              key={entry.id}
              className={`${css.levelLabel}${labelIndex === displayIndex ? ` ${css.levelLabelActive}` : ''}`}
              style={{ left: `${10 + (labelIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
            >
              {labelIndex === 0 ? 'OFF' : labelIndex === efforts.length - 1 ? 'MAX' : entry.name}
            </span>
          ))}
        </div>
        {/* 轨道无条件渲染：canvas 必须常驻 DOM，WebGL hook 才能在挂载时初始化。 */}
        <div className={css.trackWrapper}>
          <div className={css.trackBg} />
          <div className={css.dotsLayer}>
            {efforts.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`${css.dot}${dotIndex === displayIndex ? ` ${css.dotActive}` : ''}`}
                style={{ left: `${10 + (dotIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
              />
            ))}
          </div>
          <canvas ref={fireRef} className={css.fire} style={fireStyle} />
          <div className={`${css.pointLight}${dragging ? ` ${css.pointLightOn}` : ''}`} style={pointLightStyle} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={usable ? rawValue : 0}
            disabled={!usable}
            className={`${css.range}${dragging ? ` ${css.rangeGlow}` : ''}`}
            onInput={onInput}
            onPointerDown={() => setDragging(true)}
            onPointerUp={commit}
            onPointerLeave={() => setDragging(false)}
            onBlur={commit}
          />
        </div>
        {!usable && (
          <div className={css.emptyOverlay}>
            {disabled ? '模型目录加载中…' : '当前模型不提供多档推理等级'}
          </div>
        )}
      </div>
    </div>
  )
}
