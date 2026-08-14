import { clientBundle, mobileBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-remote-web-ui', ['src/index.ts', 'src/invariant.ts'], {
  libExternal: [/^@deepseek-ai\/dsh-host-apiproxy/],
  companions: [mobileBundle('@captain1275/dsh-remote-web-ui', 'src/mobile/index.tsx')],
})
