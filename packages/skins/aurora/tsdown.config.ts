import { clientBundle } from '../../../shared/tsdown.client.ts'

// 宿主半区额外 external：dsh-settings / schemastery 运行时从 dsh 配置树解析。
export default clientBundle('@captain1275/dsh-client-ui-skin-aurora', ['src/index.ts'], {
  lib: {
    external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-settings', 'schemastery'],
  },
})
