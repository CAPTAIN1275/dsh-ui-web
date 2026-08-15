/**
 * dsh-usage-dashboard — browser half. Registers:
 *  1. a sidebar foot entry (colorful chart trigger) that opens the full
 *     dashboard panel,
 *  2. an invisible conversation-dock recorder that watches the tokenUsage
 *     projection and POSTs per-response deltas to the host,
 *  3. an informational settings card in the Web UI plugin group.
 * @module @captain1275/dsh-usage-dashboard/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the sidebar seat + settings surface SlotMap merges.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the conversation dock SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { UsageEntry, type UsageEntryProps } from './UsageEntry.tsx'
import { UsageRecorder, type UsageRecorderProps } from './UsageRecorder.tsx'
import { UsageSettingsCard, type UsageSettingsCardProps } from './UsageSettingsCard.tsx'
import { NS, en, zh } from './locales.ts'

export type { UsageEntryProps } from './UsageEntry.tsx'
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
     * The sidebar foot seat beside the settings trigger, declared by the
     * sidebar shell on deployments that carry the feature seat.
     */
    'sidebar.remote': { kind: 'single'; scope: 'root'; owner: SidebarUsageOwnerProps }
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of the sidebar usage seat: the column display state. */
export interface SidebarUsageOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
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

  // Sidebar foot entry: the chart trigger + dashboard overlay. Registers into
  // the sidebar seat when the shell declares it (single seat — no id).
  ctx.slots.inject('sidebar.remote', () => ctx.slots.register({
    name: 'sidebar.remote',
    locale: NS,
  }, UsageEntry as never))

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
