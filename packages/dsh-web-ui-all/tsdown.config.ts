/**
 * Build config for the dsh-web-ui-all aggregate: node-half lib/ plus the
 * browser bundle lib/client.js (the compat shim), same client-bundle preset
 * the family packages keep (shared/tsdown.client.ts).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-web-ui-all', ['src/index.ts'])
