/**
 * dsh-pet host half — mounts the pet service and its HTTP routes. The
 * browser half (the `./client` entry) renders the whale-girl companion and
 * drives it through the same-origin `/api/pet/*` JSON endpoints plus the
 * `/pet/whale/*` media route. Install via `dsh plugin --profile web add
 * link:<dsh-web-ui>/packages/dsh-pet`; the cordis.patch.yml inserts this plugin row.
 * @module @captain1275/dsh-pet
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { PetService, type PetConfig, type PetSettingsSection } from './service.ts'
import { makePetRoutes, petPackageRoot } from './routes.ts'
import {
  DEFAULT_PET_NAME,
  DISPLAY_INSET_MAX,
  DISPLAY_SIZE_MAX,
  DISPLAY_SIZE_MIN,
  PET_NAME_MAX_LENGTH,
} from './persist.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile config values were committed into the running instance without a
     * remount (cordis-plugin-loader); dispatched to the owning fiber only.
     * @param paths - the changed config paths, as key arrays.
     * @mode emit
     */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

export { PetService } from './service.ts'
export type {
  PetConfig,
  PetInteractResult,
  PetStateView,
} from './service.ts'
export {
  AFFINITY_MAX,
  AFFINITY_RANKS,
  applyInteraction,
  applyTurnReward,
  emptyAffinity,
  rankOf,
} from './affinity.ts'
export type {
  AffinityConfig,
  AffinityState,
  InteractionOutcome,
  PetInteraction,
} from './affinity.ts'
export {
  animationForPhase,
  PetStateMachine,
  rowOf,
} from './state.ts'
export type {
  ActivityPhase,
  PetAnimation,
  PetStateConfig,
  PetStateInput,
  PetStateSnapshot,
} from './state.ts'
export {
  consumeTreat,
  defaultTreatConfig,
  emptyTreatLedger,
  settleTreatGrants,
} from './treats.ts'
export type { TreatConfig, TreatLedger, TreatSettlement } from './treats.ts'
export {
  defaultDisplayConfig,
  emptyPersist,
  loadPetPersist,
  petHomeDir,
  savePetPersist,
} from './persist.ts'
export type { PetDisplayConfig, PetPersist } from './persist.ts'

export {
  makePetRoutes,
  petPackageRoot,
  PET_API_PREFIX,
  PET_ASSET_PREFIX,
} from './routes.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'pet'

/** Services required before the pet can mount its surfaces. */
export const inject = ['webServer']

/** The stable reference a `volatile()` config field resolves to; its owner updates it in place. */
interface ConfigRef<T> {
  /** @returns the field's current value. */
  get(): T
}

/** One resolved config field: a live reference, or a plain value from a hand-built context. */
type ConfigField<T> = ConfigRef<T> | T

/** The config the Host hands to {@link apply} — the runtime face of {@link Config}. */
export interface ResolvedPetConfig extends Omit<PetConfig, 'enabled'> {
  /** Master switch. */
  visible?: ConfigField<boolean>
  /** Scale of the rendered pet in px (sprite cell height). */
  size?: ConfigField<number>
  /** Horizontal inset from the viewport right edge, px. */
  right?: ConfigField<number>
  /** Vertical inset from the viewport bottom edge, px. */
  bottom?: ConfigField<number>
  /** User-customizable pet display name. */
  name?: ConfigField<string>
  /** Master switch for the plugin (browser half + host routes). */
  enabled?: ConfigField<boolean>
}

/**
 * Plugin config schema. Under the 0.1.7 settings model this schema IS the
 * entry's settings page: the Host derives one form per profile entry from it
 * and serves it through the shared configuration forms. Every field is
 * `volatile()`, which is what puts it on that page and what lets an edit reach
 * a running instance without a remount: the loader commits the new value into
 * the field's reference and announces `loader/volatile-update` on this fiber.
 *
 * Runtime drag interactions mirror back into the settings document through the
 * service (see syncSettingsFromPet), so the document and the persisted
 * pet.json stay consistent and an empty user layer resolves to exactly what
 * the pet already shows.
 */
export const Config = z.object({
  visible: z.boolean().default(true).volatile(),
  size: z.number().step(1).min(DISPLAY_SIZE_MIN).max(DISPLAY_SIZE_MAX).default(160).volatile(),
  right: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(24).volatile(),
  bottom: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(20).volatile(),
  name: z.string().min(1).max(PET_NAME_MAX_LENGTH).pattern(/\S/).default(DEFAULT_PET_NAME).volatile(),
  enabled: z.boolean().default(true).volatile(),
})

/** Schema default, re-read for hand-built test contexts (the loader applies it normally). */
const DEFAULT_ENABLED = true

/** Read one resolved config field, following the live reference the schema produces. */
function readConfigField<T>(field: ConfigField<T> | undefined, fallback: T): T {
  if (field === undefined) return fallback
  if (typeof field === 'object' && field !== null && typeof (field as ConfigRef<T>).get === 'function') {
    const value = (field as ConfigRef<T>).get()
    return value === undefined ? fallback : value
  }
  return field as T
}

/** Register the pet service and its API + asset routes on the context. */
export function apply(ctx: Context, config: ResolvedPetConfig = {}): void {
  const service = new PetService(ctx, {
    affinity: config.affinity,
    state: config.state,
    treats: config.treats,
    persistDir: config.persistDir,
    enabled: readConfigField(config.enabled, DEFAULT_ENABLED),
  })

  // The effective settings section: the entry's volatile config fields, which
  // the loader keeps live. A field the Host does not serve falls back to what
  // the pet already shows, so a deployment without the settings surface keeps
  // the persisted pet.json values.
  const current = (): PetSettingsSection => ({
    visible: readConfigField(config.visible, service.display().visible),
    size: readConfigField(config.size, service.display().size),
    right: readConfigField(config.right, service.display().right),
    bottom: readConfigField(config.bottom, service.display().bottom),
    name: readConfigField(config.name, service.petName()),
    enabled: readConfigField(config.enabled, DEFAULT_ENABLED),
  })
  // The browser half talks to the pet through same-origin JSON endpoints and
  // loads the atlas from the pet's own media route (RPC domains are
  // platform-registered, so the pet serves its own API — the same pattern as
  // the live-stats / usage-dashboard route families). The routes are registered while
  // the plugin is enabled; toggling the setting off makes the pet API
  // disappear until it is re-enabled.
  const routes = makePetRoutes({ service, packageRoot: petPackageRoot(import.meta.url) })
  let disposeRoutes: (() => void) | undefined
  const syncRoutes = (): void => {
    const enabled = current().enabled ?? true
    if (disposeRoutes === undefined && enabled) {
      disposeRoutes = ctx.effect(
        () => {
          const disposers = routes.map((route) => ctx.webServer.register(route))
          return () => { for (const dispose of disposers) dispose() }
        },
        'pet: routes',
      )
    } else if (disposeRoutes !== undefined && !enabled) {
      disposeRoutes()
      disposeRoutes = undefined
    }
  }

  // Re-derive the pet from the current settings section: the display config,
  // the activity listeners, and the route family all follow it.
  const sync = (): void => {
    const section = current()
    service.applySettingsSection(section)
    service.setEnabled(section.enabled ?? true)
    syncRoutes()
  }

  // A settings edit is committed into this instance's config references and
  // announced on the owning fiber (the entry is not remounted), so the pet is
  // re-derived from the new values here.
  ctx.on('loader/volatile-update', () => { sync() })

  // Initial application from the config the Host activated this row with
  // (schema defaults, the profile's own values, and any stored user layer).
  sync()
}
