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
// Type-only: loads the official keyed declaration of 'settings.plugin.item'
// (rc.2+, ui-settings-plugins owns the slot type home) so the group-card
// registration above typechecks against the real slot kind.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { AboutSection } from './AboutSection.tsx'
import { PersonaSection } from './PersonaSection.tsx'
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
     * The plugin configuration section's card seat is declared by the official
     * ui-settings-plugins package as a KEYED slot in rc.2+ (keyed by the
     * settings namespace); do not re-declare it here with a different kind.
     */
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
    // rc.2: settings.plugin.item is a keyed slot (keyed by the settings
    // namespace); the old list-style `id`/`order` no longer apply.
    key: 'web-ui-plugins',
    locale: 'web-ui-plugins',
    children: { 'web-ui.plugin.item': { kind: 'list', scope: 'root' } },
  }, WebUIPluginsCard))

  // 设置页「人格设定」section：编辑并启用/禁用常驻人格（写 ~/.dsh/persona.json
  // 并同步生成 ~/.dsh/skills/catgirl-rp/SKILL.md，DSH 技能系统热加载生效）。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'persona',
    order: 98,
    label: () => '人格设定',
    locale: 'web-ui-plugins',
    inject: () => ({}),
  }, PersonaSection as never))

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
