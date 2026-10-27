/**
 * Standalone build config for the bot panel plugin.
 *
 * Host-only: the node half exposes the /api/dsh-bot route family. There is no
 * browser bundle yet, so this uses the plain tsdown entry rather than the
 * shared client preset.
 */
export default {
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  dts: false,
  clean: false,
  external: [
    '@deepseek-ai/dsh',
    '@deepseek-ai/dsh-host-webserver',
    '@deepseek-ai/dsh-tools',
  ],
}
