import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import circularDependency from 'vite-plugin-circular-dependency';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [circularDependency()],

  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },

  test: {
    globals: true,
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
    },
    coverage: {
      provider: 'v8',
      exclude: ['**/index.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'bench',
          include: ['**/*.bench.ts'],
          exclude: ['**/node_modules/**', '**/.git/**', '**/*.test.ts'],
          setupFiles: ['./src/testing-library/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'common',
          include: ['**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/.git/**', '**/*.{node,browser}.test.ts'],
          setupFiles: ['./src/testing-library/setup.ts'],
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['**/*.node.test.ts'],
          environment: 'node',
          setupFiles: ['./src/testing-library/setup.ts'],
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['**/*.browser.test.ts'],
          exclude: ['**/*.bench.ts'],
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['./src/testing-library/setup.ts'],
          benchmark: { exclude: ['**/*'] },
        },
      },
    ],
  },
});
