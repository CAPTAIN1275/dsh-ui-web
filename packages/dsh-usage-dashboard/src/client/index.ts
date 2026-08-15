/**
 * dsh-usage-dashboard — browser half. Registers:
 *  1. a DOM-injected sidebar entry (colorful chart trigger) that opens the
 *     full-screen dashboard overlay,
 *  2. an invisible conversation-dock recorder that watches the tokenUsage
 *     projection and POSTs per-response deltas to the host,
 *  3. an informational settings card in the Web UI plugin group.
 * @module @captain1275/dsh-usage-dashboard/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the conversation dock SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { mountUsageEntry } from './UsageEntry.tsx'
import { UsageRecorder } from './UsageRecorder.tsx'
import { UsageSettingsCard, type UsageSettingsCardProps } from './UsageSettingsCard.tsx'
import { NS, en, zh } from './locales.ts'

export { openDashboard, closeDashboard, mountUsageEntry } from './UsageEntry.tsx'
export type { UsageRecorderProps } from './UsageRecorder.tsx'
export type { UsageSettingsCardProps } from './UsageSettingsCard.tsx'
export type { UsageSummary } from './DashboardPanel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Usage dashboard copy. */
    'usage-dashboard': typeof zh
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Services required. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

/**
 * Register the usage dashboard surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage-dashboard: dictionaries')

  // Sidebar entry: the sidebar shell exposes no plugin slot, so the entry
  // row is injected at the DOM level (task-board / ssh precedent), self-
  // healing on React re-renders. Mounted once the settings scope settles.
  let disposeEntry: (() => void) | undefined
  ctx.effect(() => {
    disposeEntry = mountUsageEntry()
    return () => disposeEntry?.()
  }, 'usage-dashboard: sidebar entry')

  // Conversation dock recorder: invisible seat that watches tokenUsage and
  // reports deltas. Uses its own dock id so it never collides with the
  // official/full-stats stats line.
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'usage-recorder',
    order: 5,
  }, UsageRecorder as never))

  // Web UI plugin group settings card (informational).
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'usage-dashboard',
    order: 130,
    locale: NS,
  }, UsageSettingsCard as never))
}
