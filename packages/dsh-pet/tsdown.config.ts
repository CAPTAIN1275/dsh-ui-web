import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-pet', [
  'src/index.ts',
  'src/invariant.ts',
], {
  libExternal: ['@deepseek-ai/dsh-settings'],
})
