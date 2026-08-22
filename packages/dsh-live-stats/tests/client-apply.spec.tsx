import { describe, expect, it, vi } from 'vitest'
// The npm SDK's client half is a closure-factory bundle for the GUI's
// __ModuleLoader__ (not importable under vitest); provide the one value
// member the apply chain needs.
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  createSnapshotStore: (init: unknown) => ({
    get: () => init,
    set: () => {},
    subscribe: () => () => {},
  }),
}))
import { apply } from '../src/client/index.ts'

describe('live-stats client apply', () => {
  it('registers the plugin settings card and the TPS line into the composer dock', async () => {
    const injected: string[] = []
    const ctx = {
      effect: (fn: () => unknown) => fn(),
      get: () => undefined,
      locale: { register: () => () => {}, bind: () => (key: string) => key },
      slots: {
        inject: (key: string) => { injected.push(key); return () => {} },
        register: () => () => {},
      },
      settingsScope: {
        bind: () => ({
          getSnapshot: () => ({ status: 'unavailable' as const, writable: false }),
          subscribe: () => () => {},
          set: async () => {},
          unset: async () => {},
        }),
      },
    }
    apply(ctx as never)
    // The settings card mounts DIRECTLY into the official keyed settings.card
    // slot (rc.2+); the TPS line mounts into the composer dock (the shipped
    // stats-line seat, whose standard kit supplies useProjection).
    expect(injected).toEqual(['settings.plugin.item', 'conversation.composer.dock'])
  })
})
