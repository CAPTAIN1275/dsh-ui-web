/**
 * In-GUI skin center, browser half: registers the Skins plugin card into the
 * Web UI plugin group (`web-ui.plugin.item`, declared by the web-ui-settings
 * group card under 插件配置) and provides the try-on controller + official
 * theme handle to it. The card lists every installed skin (embedded
 * registry), tries it on live inside the GUI, exits with a full restore, and
 * copies the one-command apply. The plugin writes only DOM and the settings
 * ledger — no services, no events, no model access.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the renderer-owned ctx.slots Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface Context merge (ctx.configForms).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SkinCenter, type SkinCenterInjected } from './SkinCenter.tsx'
import { BackgroundController, SKIN_BACKGROUND_NS } from './background.ts'
import { en, zh, type SkinCenterKey } from './locales.ts'
import { createServedEntryForm } from './settings-entry-form.ts'
import { TryOnController } from './try-on.ts'

export type { SkinCenterComponentProps, SkinCenterInjected } from './SkinCenter.tsx'
export { TryOnController } from './try-on.ts'

/** Locale namespace owned by this plugin. */
export const NS = 'skinCenter'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The skin-center card's copy. */
    skinCenter: SkinCenterKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services: slots + locale (plugin card), theme (preview toggle), and configForms + its transport (background scrim). */
export const inject = ['slots', 'locale', 'theme', 'configForms', 'connection', 'remote']

/**
 * Register the skin-center dictionaries, the body scope attribute, and the
 * Skins plugin card inside the Web UI plugin group.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-skin-center: dictionaries')

  // The card's own styles scope under this attribute so they keep applying
  // during try-on (when the active skin's attribute is retracted).
  ctx.effect(() => {
    document.body.dataset.dshSkinCenter = ''
    return () => { delete document.body.dataset.dshSkinCenter }
  }, 'ui-skin-center: body scope')

  const theme = ctx.get('theme') as ThemeRuntime
  const controller = new TryOnController()
  // Background occluder over the shared skin-background namespace. The form
  // binds the profile entry this Host serves for that namespace, so it is torn
  // down with the card.
  const backgroundScope = createServedEntryForm<{ backgroundOpacity?: number }>({
    forms: ctx.configForms,
    entryIds: ['ui-skin-center', SKIN_BACKGROUND_NS],
  })
  const background = new BackgroundController(backgroundScope)
  const injected = (): SkinCenterInjected => ({
    controller,
    theme: {
      getTheme: () => theme.getTheme(),
      subscribe: listener => ctx.on('theme/change', listener),
      setTheme: id => theme.setTheme(id),
    },
    background: {
      opacity: () => background.opacity(),
      subscribe: listener => background.subscribe(listener),
      set: opacity => background.set(opacity),
    },
  })

  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'skins',
    order: 110,
    locale: NS,
    inject: injected,
  }, SkinCenter))
}
