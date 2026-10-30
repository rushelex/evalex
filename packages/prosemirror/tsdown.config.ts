import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  platform: 'browser',
  exports: { customExports: (exports) => ({ ...exports, './style.css': './style.css' }) },
  minify: true,
  dts: true,
  // The stylesheet is an entry point without types
  attw: { profile: 'esm-only', excludeEntrypoints: ['./style.css'] },
});
