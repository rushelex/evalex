import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    bootstrap: 'src/core/bootstrap.ts',
    core: 'src/core/index.ts',
    parser: 'src/parser/index.ts',
    runtime: 'src/runtime/index.ts',
  },
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
