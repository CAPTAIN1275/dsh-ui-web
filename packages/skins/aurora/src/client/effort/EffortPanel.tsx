/**
 * aurora Effort panel — 1:1 port of the reference EffortCard (glow border,
 * gradient card, Easy/Intense scale labels, WebGL fire track, glowing thumb,
 * drag point-light). Clicking the「推理等级」row in the official model menu
 * opens this panel instead of the level list; the slider is continuous while
 * dragging and snaps to the nearest effort level on release.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ModelCatalog, ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import { useWebglFire } from './useWebglFire.ts'
import css from './effort.module.css'

/** One Remote outcome: success carries the value, failure the Host code/message. */
type RemoteOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * 0.2.0 的 `ctx.remote.session` 面（官方生成的 typert 远程命名空间，声明见
 * `@deepseek-ai/dsh-api-session-controller/remote` 的 `TypertRemoteNamespace$73657373696f6e`）。
 * 本面板只用到这两个方法；`ConnectionHandle` 在 0.2.0 里已没有 `api` 半边。
 */
export interface SessionRemoteFace {
  /**
   * Host 全局模型目录（0.2.0 取代了按会话的 `connection.api.sessions.models`）：
   * provider 分组 + 部署默认 + 隔离的 provider 失败。
   */
  modelCatalog(): Promise<RemoteOutcome<ModelCatalog>>
  /** 写入一次完整模型选择（本面板只改 reasoningEffort，provider/model 原样回写）。 */
  selectModel(request: ModelSelectionRequest): Promise<RemoteOutcome<unknown>>
}

/** `session/selectModel` 的请求体（官方 `SessionSelectModelRequest`）。 */
interface ModelSelectionRequest {
  /** 会话身份；品牌类型 `SessionId` 在运行期就是字符串。 */
  readonly sessionId: string
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

/**
 * 会话持久的模型选择读取面。0.2.0 的目录里不再有 per-session `current`：
 * 官方选择器按 `投影 modelSelection.next ?? 目录 default` 取当前选择，本面板同序。
 */
export interface SessionSelectionSource {
  /** 当前选择（投影的 `next`），无投影时为 undefined。 */
  get(): ModelSelection | undefined
  /** 订阅投影变化；返回退订函数。 */
  subscribe(listener: () => void): () => void
}

/** Panel props: owning session, Host Remote face, close verb. */
export interface EffortPanelProps {
  sessionId: string
  /** Host 远程面（`ctx.remote.session`）。 */
  remote: SessionRemoteFace
  /** 该会话的持久模型选择投影；缺失时回退到目录的部署默认。 */
  selection?: SessionSelectionSource
  onClose: () => void
}

/** Panel width (must match the CSS `.panel` width). */
const PANEL_W = 280

/** Load the Host model catalog once per panel open (0.2.0: Host-global, no sessionId). */
function useCatalog(remote: SessionRemoteFace): ModelCatalog | null {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)

  useEffect(() => {
    let alive = true
    setCatalog(null)
    void remote.modelCatalog()
      .then((response) => {
        console.log('[aurora-effort] modelCatalog:', response.ok
          ? `ok groups=${response.value.groups.length} default=${JSON.stringify(response.value.default)}`
          : `fail ${response.error.code}: ${response.error.message}`)
        if (alive && response.ok) setCatalog(response.value)
      })
      .catch((error: unknown) => {
        console.warn('[aurora-effort] modelCatalog threw:', error)
      })
    return () => {
      alive = false
    }
  }, [remote])

  return catalog
}

/** 订阅该会话持久的模型选择（没有投影读取面时保持 undefined）。 */
function useSelection(source: SessionSelectionSource | undefined): ModelSelection | undefined {
  const [selection, setSelection] = useState<ModelSelection | undefined>(() => source?.get())

  useEffect(() => {
    if (source === undefined) return
    setSelection(source.get())
    return source.subscribe(() => setSelection(source.get()))
  }, [source])

  return selection
}

/**
 * The floating effort card.
 * @param props - session + Host Remote face + close verb.
 */
export function EffortPanel(props: EffortPanelProps): ReactElement {
  const { sessionId, remote, selection: selectionSource, onClose } = props
  const catalog = useCatalog(remote)
  const projected = useSelection(selectionSource)
  const [dragging, setDragging] = useState(false)
  // Continuous 0..100 slider position; snaps to an effort level on release.
  const [rawValue, setRawValue] = useState(0)

  const disabled = catalog === null
  // 会话投影优先，无投影时用目录的部署默认（目录数据总是可用的）。
  const current = projected ?? catalog?.default ?? null
  const group = current === null ? undefined : catalog?.groups.find((entry) => entry.id === current.provider)
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
  }, [current])

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
    void remote.selectModel({
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
