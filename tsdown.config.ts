import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'browser',
  exports: true,
  minify: true,
  dts: true,
  // Dates in the public types are the global `Temporal` types, so hosts get them without changing their own `lib`
  banner: { dts: '/// <reference lib="esnext.temporal" />' },
  attw: { profile: 'esm-only' },
  deps: {
    onlyBundle: ['type-fest'],
  },
  alias: {
    '~/*': './src/*',
  },
});
