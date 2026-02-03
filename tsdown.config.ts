import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'browser',
  exports: true,
  minify: true,
  dts: true,
  attw: { profile: 'esm-only' },
  inlineOnly: ['type-fest'],
  alias: {
    '~/*': './src/*',
  },
});
