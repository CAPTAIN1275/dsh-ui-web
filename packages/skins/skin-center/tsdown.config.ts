import { clientBundle } from '../../../shared/tsdown.client.ts'

export default clientBundle(
  '@captain1275/dsh-client-ui-skin-center',
  ['src/index.ts'],
  {
    lib: {
      // 宿主侧会在运行时�?dsh 配置树解�?dsh-settings / schemastery，而非本地安装�?      // 保持外部（同 dsh-live-stats �?stance）�?      external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-settings', 'schemastery'],
    },
  },
)
