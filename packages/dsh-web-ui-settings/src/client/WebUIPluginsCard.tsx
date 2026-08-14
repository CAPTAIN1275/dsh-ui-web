/**
 * The Web UI plugin group card. Renders as one item in the
 * `settings.plugin.item` list and, when expanded, renders every family
 * plugin card into its own child slot. The card chrome mirrors the official
 * ui-plugin-config PluginCard so the group reads as a sibling of the built-in
 * Shell / Agent loop / Web search cards.
 */

import { useState, type ReactNode } from 'react'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { WebUIPluginsKey } from './locales.ts'
import css from './web-ui-settings.module.css'

/** Owner share of the group card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Props the group card binds. */
export interface WebUIPluginsCardProps {
  /** Locale reader for this card's copy. */
  t: (key: WebUIPluginsKey) => string
  /** Runtime slot rendering for the family plugin cards. */
  renderSlot: PropsRenderSlots<'web-ui.plugin.item'>['renderSlot']
}

/**
 * Render the group card with the child plugin cards inside its body.
 * @param props - locale copy and the child slot renderer.
 * @returns the group card, or nothing when the section does not exist.
 */
export function WebUIPluginsCard(props: WebUIPluginsCardProps): ReactNode {
  const { t, renderSlot } = props
  const [open, setOpen] = useState(false)
  return (
    <li className={css.groupCard}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name} title={t('title')}>{t('title')}</span>
          <span className={css.description} title={t('description')}>{t('description')}</span>
        </span>
        <span className={open ? css.chevronOpen : css.chevron}>▾</span>
      </button>
      {open
        ? (
          <div className={css.body}>
            <ul className={css.subcards}>
              {renderSlot('web-ui.plugin.item', {})}
            </ul>
          </div>
        )
        : null}
    </li>
  )
}
