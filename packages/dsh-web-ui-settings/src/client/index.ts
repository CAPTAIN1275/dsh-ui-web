/**
 * Web UI plugin group, browser half. Registers the `web-ui-plugins`
 * dictionaries and one first-level settings section that renders the family
 * plugin cards. The section declares the `web-ui.plugin.item` child slot; the
 * dsh-web-ui family plugins register their per-plugin cards there, so the
 * settings page shows a single Web UI Plugins entry instead of one page per
 * family plugin.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the renderer-owned ctx.slots Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section'
// entry) and the shared-forms Context merge (ctx.configForms).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AboutSection } from './AboutSection.tsx'
import { PersonaSection } from './PersonaSection.tsx'
import { WebUIPluginsSection } from './WebUIPluginsSection.tsx'
import { en, zh, type WebUIPluginsKey } from './locales.ts'

export type { WebUIPluginsSectionProps } from './WebUIPluginsSection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Web UI plugin group copy. */
    'web-ui-plugins': WebUIPluginsKey
  }

  interface SlotMap {
    /**
     * The child slot one family plugin card registers into, declared by the
     * group section. A list seat keyed by entry id, so the family plugins can
     * reuse their existing card implementations.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services. */
export const inject = ['slots', 'locale']

/**
 * Register the Web UI plugin group as a first-level settings section: its own
 * nav item hosts the family plugin cards in the section body.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('web-ui-plugins', { zh, en }), 'web-ui-settings: dictionaries')

  // Web UI 插件组：一级设置页，家族插件的卡片挂进它声明的 web-ui.plugin.item 子 slot。
  // rc.2 起官方的 settings.plugin.item keyed 席位已被移除（组卡片原来的落点），
  // 因此组卡片改成自建的一级 section，聚合形态不变。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'web-ui-plugins',
    order: 110,
    label: () => ctx.locale.bind('web-ui-plugins')('title'),
    locale: 'web-ui-plugins',
    children: { 'web-ui.plugin.item': { kind: 'list', scope: 'root' } },
  }, WebUIPluginsSection))

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
