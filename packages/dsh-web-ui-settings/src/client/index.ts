/**
 * Web UI plugin group, browser half. Registers the `web-ui-plugins`
 * dictionaries and one group card into the plugin-configuration section. The
 * group card declares the `web-ui.plugin.item` child slot; the dsh-web-ui
 * family plugins register their per-plugin cards there, so the settings page
 * shows a single Web UI Plugins entry instead of one top-level card per
 * family plugin.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section'
// entry) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AboutSection } from './AboutSection.tsx'
import { WebUIPluginsCard } from './WebUIPluginsCard.tsx'
import { en, zh, type WebUIPluginsKey } from './locales.ts'

export type { WebUIPluginsCardProps } from './WebUIPluginsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Web UI plugin group card copy. */
    'web-ui-plugins': WebUIPluginsKey
  }

  interface SlotMap {
    /**
     * The child slot one family plugin card registers into, declared by the
     * group card. Shape mirrors `settings.plugin.item` so the family plugins
     * can reuse their existing card implementations.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
    /**
     * The plugin configuration section's card seat, declared by
     * ui-plugin-config. Spelled here with the same shape so this package can
     * register its group card without depending on the sibling UI package.
     */
    'settings.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services. */
export const inject = ['slots', 'locale']

/**
 * Register the Web UI plugin group.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('web-ui-plugins', { zh, en }), 'web-ui-settings: dictionaries')

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    id: 'web-ui-plugins',
    order: 90,
    locale: 'web-ui-plugins',
    children: { 'web-ui.plugin.item': { kind: 'list', scope: 'root' } },
  }, WebUIPluginsCard))

  // 设置页「关于」section：与通用/模型/插件/Agent 预设同级，排最后。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'about',
    order: 99,
    label: () => '关于',
    locale: 'web-ui-plugins',
    inject: () => ({}),
  }, AboutSection as never))
}
