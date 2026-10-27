/**
 * Standalone build config for the bot panel plugin.
 *
 * Uses the repo's shared client-bundle preset (shared/tsdown.client.ts): the
 * node half goes to lib/index.js (host routes) and the browser half to
 * lib/client.js, which the GUI's __ModuleLoader__ picks up. The client entry
 * is auto-detected at src/client/index.ts by the preset.
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-bot-panel', ['src/index.ts'], {
  libExternal: ['@deepseek-ai/dsh-host-webserver'],
})
