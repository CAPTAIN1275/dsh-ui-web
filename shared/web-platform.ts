/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * Mirrors the frozen module table the running 0.2.0-rc.2 desktop build
 * actually seeds: react, react/jsx-runtime, react-dom, react-dom/client,
 * cordis, dsh-client-ui-slots, dsh-client-ui-primitives, dsh-client-ui-dockkit.
 *
 * The retired dsh-client-runtime row is gone (the package was removed
 * upstream). Its store engine now lives in @deepseek-ai/dsh-client-store, which
 * is NOT a module-table word on this shell: externalizing it made every client
 * bundle fail to load with "require(...) missed the module table". It INLINES
 * instead (see INLINE_SAFE in tsdown.client.ts) -- safe because the engine is a
 * pure factory set with no shared runtime identity to preserve.
 * @module dsh-web-ui/shared/web-platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
