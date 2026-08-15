/**
 * Standalone build config for the usage dashboard plugin.
 * Uses the vendored dsh client-bundle preset (shared/tsdown.client.ts).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-usage-dashboard', ['src/index.ts'])
