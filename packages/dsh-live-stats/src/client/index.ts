import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the settings-surface SlotMap merge (the definitions that
// name the 'settings.*' holes) and the ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { LiveStatsSettingsCard, LiveStatsSettingsCardController, type LiveStatsSettings } from './LiveStatsSettingsCard.tsx'
import { TpsLineDockEntry } from './TpsLine.tsx'
import { createServedEntryForm } from './settings-entry-form.ts'
import { en, zh, type SettingsCardKey } from './locales.ts'

export { TpsLine, formatTokensPerSecond } from './TpsLine.tsx'
export type { LiveStatsSettings, LiveStatsSettingsCardFace, LiveStatsSettingsCardState } from './LiveStatsSettingsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** live-stats settings-card copy. */
    'live-stats': SettingsCardKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level settings list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional family binder provided by dsh-web-ui-settings; absent when that
     * group plugin is not installed, so callers fall back to the official
     * shared configuration forms.
     */
    webUiSettings?: { bind<S>(spec: { namespace: string }): ConfigForm<S> }
  }
}


/** Dictionary namespace owned by this plugin. */
const NS = 'live-stats'

/**
 * Candidate profile entry ids for the live-stats row, most likely first: the
 * aggregate's generated row, the package's own standalone row, then the bare
 * namespace (the row id the cordis patch inserts).
 */
const LIVE_STATS_ENTRY_IDS = [
  'web-ui-live-stats',
  '@captain1275/dsh-live-stats',
  'live-stats',
] as const

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'connection', 'configForms', 'remote']

/**
 * Register the live-stats surface: the generation-throughput TPS group lives
 * in the ui-conversation stats line (read directly from the `liveTokenUsage`
 * projection), and this build of the browser half mounts the plugin settings
 * card over the entry the Host serves.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'live-stats: dictionaries')

  // Plugin configuration card: one staged form over the profile entry the Host
  // serves, contributed to the Web UI plugin group's own child slot. The family
  // binder is preferred; without it the card binds the shared configuration
  // forms service directly by entry id.
  const binder = ctx.get('webUiSettings')
  const forms: ConfigForms = ctx.configForms
  const liveStatsSettings = new LiveStatsSettingsCardController(
    binder !== undefined
      ? binder.bind<LiveStatsSettings>({ namespace: NS })
      : createServedEntryForm<LiveStatsSettings>({ forms, entryIds: LIVE_STATS_ENTRY_IDS }),
  )
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'live-stats',
    order: 110,
    locale: NS,
    inject: () => liveStatsSettings.inject(),
  }, LiveStatsSettingsCard))

  // The live TPS row mounts on the composer dock (the shipped stats-line
  // seat). Its session standard kit supplies `useProjection`, which reads the
  // host's `liveTokenUsage` projection. Previously TpsLine was only exported
  // for shell integration and never actually mounted on rc.6 (issue #56).
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'live-stats',
    order: 100,
  }, TpsLineDockEntry as never))
}
