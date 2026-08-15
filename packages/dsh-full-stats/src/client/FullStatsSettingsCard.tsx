/**
 * dsh-full-stats 配置卡片：注册进 WebUI 插件组（web-ui.plugin.item）。
 * 可折叠卡片：点击头部展开/收起配置区。用户可自定义「工作中 / 完成时」状态
 * 文本；保存经宿主路由 /api/full-stats/config 持久化（~/.dsh/full-stats.json），
 * 并派发 dshc-full-stats-config 事件让统计行即时刷新。
 */
import { useEffect, useState } from 'react'
import css from './card.module.css'

/** 配置形状（与宿主一致）。 */
export interface FullStatsConfig {
  thinkingText: string
  workingText: string
  doneText: string
}

const DEFAULTS: FullStatsConfig = { thinkingText: '', workingText: '', doneText: '' }

/** 配置变更事件（统计行监听刷新）。 */
export const FULL_STATS_EVENT = 'dshc-full-stats-config'

/** 解析一个模块类名。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

async function fetchConfig(): Promise<FullStatsConfig> {
  try {
    const res = await fetch('/api/full-stats/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<FullStatsConfig> }
    if (data?.ok === true && data.config !== undefined) {
      return {
        thinkingText: typeof data.config.thinkingText === 'string' ? data.config.thinkingText : DEFAULTS.thinkingText,
        workingText: typeof data.config.workingText === 'string' ? data.config.workingText : DEFAULTS.workingText,
        doneText: typeof data.config.doneText === 'string' ? data.config.doneText : DEFAULTS.doneText,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

async function writeConfig(next: FullStatsConfig): Promise<boolean> {
  try {
    const res = await fetch('/api/full-stats/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
    const data = (await res.json()) as { ok?: boolean }
    return data?.ok === true
  } catch {
    return false
  }
}

/** WebUI 插件组中的可折叠配置卡片。 */
export function FullStatsSettingsCard() {
  const [cfg, setCfg] = useState<FullStatsConfig>(DEFAULTS)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchConfig().then((c) => {
      if (alive) setCfg(c)
    })
    return () => {
      alive = false
    }
  }, [])

  const save = async (): Promise<void> => {
    setSaving(true)
    setSaved(false)
    const ok = await writeConfig(cfg)
    setSaving(false)
    if (ok) {
      setSaved(true)
      window.dispatchEvent(new Event(FULL_STATS_EVENT))
      window.setTimeout(() => setSaved(false), 1500)
    } else {
      window.alert('配置保存失败')
    }
  }

  return (
    <li className={`${cls('card')}${open ? ` ${cls('cardOpen')}` : ''}`}>
      <button
        type="button"
        className={cls('header')}
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}: 完整统计行（状态文本）`}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className={cls('headText')}>
          <span className={cls('name')}>完整统计行（状态文本）</span>
          <span className={cls('description')}>自定义状态文本与完整统计（轮/步/耗时/缓存/token）</span>
        </span>
        <span className={open ? cls('chevronOpen') : cls('chevron')}>▾</span>
      </button>
      {open && (
        <div className={cls('body')}>
          <p className={cls('desc')}>
            自定义状态文本：思考中（替换官方 Deep diving...）、工作中、完成时；
            留空则显示原始内容。完整统计（轮/步/耗时/缓存/token）始终保留。
          </p>
          <label className={cls('field')}>
            <span className={cls('fieldLabel')}>思考中状态文本（替换 Deep diving...）</span>
            <input
              type="text"
              className={cls('input')}
              value={cfg.thinkingText}
              placeholder="例如：小咪正在努力思考喵..."
              onChange={(e) => setCfg({ ...cfg, thinkingText: e.target.value })}
            />
          </label>
          <label className={cls('field')}>
            <span className={cls('fieldLabel')}>工作中状态文本</span>
            <input
              type="text"
              className={cls('input')}
              value={cfg.workingText}
              placeholder="例如：大肥鱼正在吃白饭"
              onChange={(e) => setCfg({ ...cfg, workingText: e.target.value })}
            />
          </label>
          <label className={cls('field')}>
            <span className={cls('fieldLabel')}>完成时状态文本</span>
            <input
              type="text"
              className={cls('input')}
              value={cfg.doneText}
              placeholder="例如：大肥鱼吃饱了"
              onChange={(e) => setCfg({ ...cfg, doneText: e.target.value })}
            />
          </label>
          <div className={cls('actions')}>
            <button
              type="button"
              className={cls('saveBtn')}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            {saved && <span className={cls('savedHint')}>已保存</span>}
          </div>
        </div>
      )}
    </li>
  )
}
