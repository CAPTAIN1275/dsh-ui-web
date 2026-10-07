import { describe, expect, it, vi } from 'vitest'
// The npm SDK's store package reaches zustand/immer value imports that the
// vitest resolver cannot follow from this package; provide the two members the
// client apply chain needs. The settings surface is stubbed for the same
// reason: only its describe mirror is consulted at activation.
vi.mock('@deepseek-ai/dsh-client-store', () => ({
  createSnapshotStore: (init: unknown) => ({
    get: () => init,
    set: () => {},
    subscribe: () => () => {},
  }),
}))
vi.mock('@deepseek-ai/dsh-client-ui-settings/client', () => ({
  ConfigForms: class {},
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
      configForms: {
        describe: () => ({
          getSnapshot: () => ({ view: { namespaces: [] } }),
          subscribe: () => () => {},
        }),
        get: () => ({
          getSnapshot: () => ({ status: 'unavailable' as const, writable: false }),
          subscribe: () => () => {},
          set: async () => false,
          unset: async () => false,
          mutate: async () => false,
        }),
      },
    }
    apply(ctx as never)
    // The card mounts into the Web UI plugin group; the TPS line mounts into
    // the composer dock (the shipped stats-line seat, whose standard kit
    // supplies useProjection) so the live throughput row actually renders.
    expect(injected).toEqual(['web-ui.plugin.item', 'conversation.composer.dock'])
  })
})
