import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-session-projection'
import { resolveEstimatorConfig } from './estimator.ts'
import type { EstimatorConfig } from './estimator.ts'
import { createLiveTokenUsageProjectionDefinition } from './projection.ts'

/** Services required by the host projection plugin. */
export const inject = ['sessionProjections']

/**
 * Settings namespace of the live-stats capability — the section the web
 * settings surface edits. Spelled here rather than imported so the browser
 * half can spell the same value without depending on a Host package.
 */
export const LIVE_STATS_SETTINGS_NAMESPACE = 'live-stats'

/** Plugin configuration for provider-independent token estimation. */
export interface Config extends EstimatorConfig {
  /** Master switch for the plugin (browser half + host projection). */
  enabled?: boolean
}

/**
 * Plugin config schema. Under the 0.2.0 settings model this schema IS the
 * profile entry's settings page: the Host derives one form per entry from it
 * and serves it through the shared configuration forms, so no registration
 * call is involved.
 *
 * Every field is `volatile()`: that is what puts it on that page and what
 * makes an edit reach a RUNNING instance without a remount. The loader parses
 * a volatile field into a stable reference, commits the new value into it in
 * place, and announces `loader/volatile-update` on this fiber — which is
 * exactly what {@link apply}'s rebuild listens for.
 *
 * The schema carries no explicit type annotation on purpose: `volatile()`
 * changes the schema's OUTPUT to a reference, so annotating the declaration
 * with the plain `Config` shape is a type error (TS2322).
 */
export const Config = z.object({
  charsPerToken: z.number().min(0.01).default(4).volatile(),
  blockOverhead: z.number().step(1).min(0).default(4).volatile(),
  roleOverhead: z.number().step(1).min(0).default(4).volatile(),
  enabled: z.boolean().default(true).volatile(),
})

/** The stable reference a volatile config field resolves to; its owner updates it in place. */
interface ConfigRef<T> {
  /** @returns the field's current value. */
  get(): T
}

/** One resolved config field: a live reference, or a plain value from a hand-built context. */
type ConfigField<T> = ConfigRef<T> | T

/** The config the Host hands to {@link apply} — the runtime face of {@link Config}. */
export interface ResolvedConfig {
  charsPerToken?: ConfigField<number>
  blockOverhead?: ConfigField<number>
  roleOverhead?: ConfigField<number>
  enabled?: ConfigField<boolean>
}

/** Read one resolved config field, following the live reference the schema may produce. */
function readConfigField<T>(field: ConfigField<T> | undefined, fallback: T): T {
  if (field === undefined) return fallback
  if (typeof field === 'object' && field !== null && typeof (field as ConfigRef<T>).get === 'function') {
    const value = (field as ConfigRef<T>).get()
    return value === undefined ? fallback : value
  }
  return field as T
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile config values were committed into the running instance without
     * a remount (cordis-plugin-loader); dispatched to the owning fiber only.
     * @param paths - the changed config paths, as key arrays.
     * @mode emit
     */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

/**
 * Register the replayable live-token projection.
 *
 * The projection definition freezes its estimator spec into the fold's
 * closure at construction, so a settings edit takes effect by re-registering
 * the definition against the authoritative source. `sessionProjections.register`
 * returns the exact disposer, letting us drop the stale fold and fold the
 * session log afresh with the new parameters — the live-estimate row simply
 * re-derives without a restart.
 * @param ctx - host plugin context carrying sessionProjections.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(ctx: Context, config?: ResolvedConfig): void {
  let disposeProjection: (() => void) | undefined

  const rebuild = (): void => {
    if (disposeProjection !== undefined) {
      disposeProjection()
      disposeProjection = undefined
    }
    if (readConfigField(config?.enabled, true) === false) return
    const spec = resolveEstimatorConfig({
      charsPerToken: readConfigField(config?.charsPerToken, 4),
      blockOverhead: readConfigField(config?.blockOverhead, 4),
      roleOverhead: readConfigField(config?.roleOverhead, 4),
    })
    const definition = createLiveTokenUsageProjectionDefinition(spec)
    // rc.2: the wire overload requires a non-optional `wire`; reconstruct the
    // object with an explicit wire so the required-wire overload matches
    // (ProjectionDefinition itself keeps wire optional).
    disposeProjection = ctx.sessionProjections.register({
      key: definition.key,
      stateSchema: definition.stateSchema,
      init: definition.init,
      apply: definition.apply,
      stateVersion: definition.stateVersion,
      wire: {
        viewSchema: definition.wire!.viewSchema,
        view: definition.wire!.view,
      },
    })
  }

  // A settings edit is committed into this instance's config references and
  // announced on the owning fiber (the entry is not remounted), so the fold is
  // re-derived from the new values here.
  ctx.on('loader/volatile-update', () => { rebuild() })

  rebuild()
}

export { createLiveTokenUsageProjectionDefinition } from './projection.ts'
export { resolveEstimatorConfig } from './estimator.ts'
export type { EstimatorConfig, EstimatorSpec } from './estimator.ts'
