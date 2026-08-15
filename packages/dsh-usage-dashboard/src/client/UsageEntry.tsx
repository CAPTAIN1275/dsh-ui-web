/**
 * Usage dashboard entry — the sidebar seat. A colorful chart button that
 * opens the full-screen dashboard panel. Also drives the recorder's model
 * name from the connection layer.
 * @module @captain1275/dsh-usage-dashboard/client/UsageEntry
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DashboardPanel } from './DashboardPanel.tsx'
import { setCurrentModel } from './UsageRecorder.tsx'
import css from './usage-entry.module.css'
import { t } from './locales.ts'

/** Entry props: sidebar column state + connection snapshot hook. */
export interface UsageEntryProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
  /** Session-selection hook (connection) to read the active model. */
  useSessions: <S>(selector: (s: { current?: { provider?: string; model?: string } }) => S) => S
}

/**
 * Render the usage trigger and dashboard overlay.
 * @param props - column state and connection hook.
 * @returns the entry element tree.
 */
export function UsageEntry({ wide, useSessions }: UsageEntryProps) {
  const [open, setOpen] = useState(false)
  const session = useSessions((s) => ({ current: s.current }))

  // Keep the recorder's model label in sync with the active selection.
  useEffect(() => {
    const model = session.current?.model
    if (typeof model === 'string' && model.length > 0) {
      setCurrentModel(model)
    }
  }, [session.current?.model])

  const close = useCallback((): void => { setOpen(false) }, [])

  return (
    <>
      <button
        type="button"
        className={css.trigger}
        data-wide={wide ? undefined : 'rail'}
        aria-label={t('usage.entry')}
        title={t('usage.entry')}
        onClick={() => { setOpen(true) }}
      >
        <svg viewBox="0 0 18 18" width={wide ? 16 : 18} height={wide ? 16 : 18} aria-hidden="true">
          <rect x="2" y="9" width="3" height="7" rx="1" fill="#f472b6" />
          <rect x="7" y="5" width="3" height="11" rx="1" fill="#fb923c" />
          <rect x="12" y="2" width="3" height="14" rx="1" fill="#4ade80" />
        </svg>
      </button>
      {open && createPortal((
        <DashboardPanel onClose={close} />
      ), document.body)}
    </>
  )
}
