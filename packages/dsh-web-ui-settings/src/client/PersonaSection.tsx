/**
 * 设置页「人格设定」section：开关 + 人格名称 + 描述 + 正文编辑，保存后由宿主
 * 写入 ~/.dsh/persona.json 并同步生成 ~/.dsh/skills/catgirl-rp/SKILL.md，
 * DSH 技能系统实时热加载，人格常驻生效。
 * @module @captain1275/dsh-client-ui-web-ui-settings/client/PersonaSection
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import css from './persona.module.css'

/** 与宿主路由约定一致的人格配置形状。 */
export interface PersonaConfigView {
  enabled: boolean
  name: string
  description: string
  content: string
}

/** 一个内置人格预设。 */
export interface PersonaPresetView {
  id: string
  label: string
  persona: PersonaConfigView
}

const PERSONA_CONFIG_URL = '/api/persona/config'
const PERSONA_PRESETS_URL = '/api/persona/presets'

/** 从宿主读取当前人格配置。 */
async function fetchConfig(): Promise<PersonaConfigView> {
  const response = await fetch(PERSONA_CONFIG_URL)
  if (!response.ok) throw new Error(`persona config GET failed: ${response.status}`)
  const data = (await response.json()) as { ok: boolean; config: PersonaConfigView }
  return data.config
}

/** 从宿主读取内置人格预设。 */
async function fetchPresets(): Promise<PersonaPresetView[]> {
  try {
    const response = await fetch(PERSONA_PRESETS_URL)
    if (!response.ok) return []
    const data = (await response.json()) as { ok: boolean; presets: PersonaPresetView[] }
    return Array.isArray(data.presets) ? data.presets : []
  } catch {
    return []
  }
}

/** 保存人格配置到宿主。 */
async function saveConfig(config: PersonaConfigView): Promise<PersonaConfigView> {
  const response = await fetch(PERSONA_CONFIG_URL, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = (await response.json()) as { ok: boolean; config?: PersonaConfigView; error?: string }
  if (!response.ok || data.ok !== true || data.config === undefined) {
    throw new Error(data.error ?? `persona config PUT failed: ${response.status}`)
  }
  return data.config
}

/**
 * 人格设定表单：开关人格、编辑名称/描述/正文，保存后即时生效。
 * @param props - 组件属性（无）。
 */
export function PersonaSection(): ReactElement {
  const [config, setConfig] = useState<PersonaConfigView | null>(null)
  const [draft, setDraft] = useState<PersonaConfigView | null>(null)
  const [presets, setPresets] = useState<PersonaPresetView[]>([])
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
    void fetchPresets().then(setPresets)
  }, [])

  const update = useCallback((patch: Partial<PersonaConfigView>) => {
    setDraft((prev) => (prev === null ? prev : { ...prev, ...patch }))
    setSaved(false)
  }, [])

  /** 一键填充预设到草稿（不直接保存，可编辑后保存）。 */
  const applyPreset = useCallback((preset: PersonaPresetView) => {
    setDraft((prev) => {
      if (prev === null) return prev
      return {
        enabled: prev.enabled,
        name: preset.persona.name,
        description: preset.persona.description,
        content: preset.persona.content,
      }
    })
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [draft])

  if (config === null || draft === null) {
    return (
      <div className={css.persona}>
        {error !== null ? <div className={css.error}>{error}</div> : <div className={css.hint}>加载中...</div>}
      </div>
    )
  }

  return (
    <div className={css.persona}>
      <div className={css.row}>
        <label className={css.switchRow}>
          <input
            className={css.switch}
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>启用人格（常驻生效）</span>
        </label>
      </div>

      {presets.length > 0 && (
        <div className={css.row}>
          <span className={css.label}>预设：</span>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={css.presetBtn}
              onClick={() => applyPreset(preset)}
              title="填充预设内容到下方表单（可继续编辑后保存）"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className={css.field}>
        <label className={css.label} htmlFor="persona-name">技能名（小写字母/数字/短横线）</label>
        <input
          id="persona-name"
          className={css.input}
          value={draft.name}
          spellCheck={false}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>

      <div className={css.field}>
        <label className={css.label} htmlFor="persona-description">描述（技能匹配用，建议包含 Use when）</label>
        <textarea
          id="persona-description"
          className={css.textarea}
          rows={4}
          value={draft.description}
          spellCheck={false}
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>

      <div className={css.field}>
        <label className={css.label} htmlFor="persona-content">人格设定正文（Markdown，SKILL.md 主体）</label>
        <textarea
          id="persona-content"
          className={css.content}
          rows={18}
          value={draft.content}
          spellCheck={false}
          onChange={(e) => update({ content: e.target.value })}
        />
      </div>

      <div className={css.actions}>
        <button className={css.save} type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '保存中...' : '保存'}
        </button>
        {saved && <span className={css.saved}>已保存并生效</span>}
        {error !== null && <span className={css.error}>{error}</span>}
      </div>

      <div className={css.note}>
        保存后写入 ~/.dsh/skills/catgirl-rp/SKILL.md，DSH 技能系统自动热加载；禁用时将文件暂存为
        SKILL.md.disabled（不删除，重新启用即恢复）。
      </div>
    </div>
  )
}
