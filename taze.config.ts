import { defineConfig } from 'taze';

export default defineConfig({
  // typescript-eslint does not support TS 7.0: https://github.com/typescript-eslint/typescript-eslint/issues/10940
  exclude: ['typescript@~7.0'],
  ignorePaths: [
    '**/node_modules/**',
  ],
  packageMode: {
    '@types/node': 'minor',
  },
});
