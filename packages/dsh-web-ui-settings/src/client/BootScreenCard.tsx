/**
 * 启动屏配置卡：注册进 WebUI 插件组（web-ui.plugin.item）。
 * 自定义刷新时的启动屏：启动标题（HARNESS）、启动提示（Loading plugins...）、
 * 启动背景图 URL。保存经宿主 /api/bootscreen/config 持久化
 * （~/.dsh/bootscreen.json），client 端 MutationObserver 替换生效。
 * @module @captain1275/dsh-client-ui-web-ui-settings/client/BootScreenCard
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import css from './persona.module.css'

/** 与宿主路由约定一致的启动屏配置。 */
export interface BootScreenConfigView {
  title: string
  hint: string
  backgroundUrl: string
}

const BOOTSCREEN_CONFIG_URL = '/api/bootscreen/config'

/** 从宿主读取当前配置。 */
async function fetchConfig(): Promise<BootScreenConfigView> {
  const response = await fetch(BOOTSCREEN_CONFIG_URL)
  if (!response.ok) throw new Error(`bootscreen config GET failed: ${response.status}`)
  const data = (await response.json()) as { ok: boolean; config: BootScreenConfigView }
  return data.config
}

/** 保存配置到宿主。 */
async function saveConfig(config: BootScreenConfigView): Promise<BootScreenConfigView> {
  const response = await fetch(BOOTSCREEN_CONFIG_URL, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = (await response.json()) as { ok: boolean; config?: BootScreenConfigView; error?: string }
  if (!response.ok || data.ok !== true || data.config === undefined) {
    throw new Error(data.error ?? `bootscreen config PUT failed: ${response.status}`)
  }
  return data.config
}

/**
 * 启动屏配置表单。
 * @param props - 组件属性（无）。
 * @returns 配置卡元素。
 */
export function BootScreenCard(_props: Record<string, never>): ReactNode {
  const [config, setConfig] = useState<BootScreenConfigView | null>(null)
  const [draft, setDraft] = useState<BootScreenConfigView | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg)
        setDraft(cfg)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const update = useCallback((patch: Partial<BootScreenConfigView>) => {
    setDraft((prev) => (prev === null ? prev : { ...prev, ...patch }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (draft === null) return
    setSaving(true)
    setError(null)
    try {
      const next = await saveConfig(draft)
      setConfig(next)
      setDraft(next)
      setSaved(true)
      // 触发页面内替换器重读（下次启动屏出现时生效）。
      window.dispatchEvent(new Event('dshc-bootscreen-config'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [draft])

  if (config === null || draft === null) {
    return (
      <li className={css.card}>
        {error !== null ? <div className={css.error}>{error}</div> : <div className={css.hint}>加载中...</div>}
      </li>
    )
  }

  return (
    <li className={css.card}>
      <div className={css.field}>
        <label className={css.label} htmlFor="bootscreen-title">启动标题（替换 HARNESS，留空保持默认）</label>
        <input
          id="bootscreen-title"
          className={css.input}
          value={draft.title}
          placeholder="HARNESS"
          spellCheck={false}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <div className={css.field}>
        <label className={css.label} htmlFor="bootscreen-hint">启动提示（替换 Loading plugins...，留空保持默认）</label>
        <input
          id="bootscreen-hint"
          className={css.input}
          value={draft.hint}
          placeholder="Loading plugins..."
          spellCheck={false}
          onChange={(e) => update({ hint: e.target.value })}
        />
      </div>
      <div className={css.field}>
        <label className={css.label} htmlFor="bootscreen-bg">启动背景图 URL（留空保持默认）</label>
        <input
          id="bootscreen-bg"
          className={css.input}
          value={draft.backgroundUrl}
          placeholder="https://example.com/boot.png"
          spellCheck={false}
          onChange={(e) => update({ backgroundUrl: e.target.value })}
        />
      </div>
      <div className={css.actions}>
        <button className={css.save} type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '保存中...' : '保存'}
        </button>
        {saved && <span className={css.saved}>已保存</span>}
        {error !== null && <span className={css.error}>{error}</span>}
      </div>
      <div className={css.note}>
        刷新页面时会看到启动屏（HARNESS / Loading plugins...），配置后文本与背景会被替换；
        首次加载瞬间插件未就绪，替换在插件加载后生效。
      </div>
    </li>
  )
}
