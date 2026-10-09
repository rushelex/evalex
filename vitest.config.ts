import path from 'node:path';

import { playwright } from '@vitest/browser-playwright';
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
    coverage: {
      provider: 'v8',
      include: ['src/**/*.(c|m)?[jt]s(x)?'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/index.ts'],
    },
    exclude: ['**/*.{bench,benchmark}.ts'],
    setupFiles: ['./src/testing-library/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/.git/**',
            '**/*.{browser,bench,benchmark,integration}.test.ts',
            '**/*.test-d.ts',
          ],
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'types',
          include: ['**/*.test-d.ts'],
          typecheck: {
            enabled: true,
            only: true,
            ignoreSourceErrors: true,
          },
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['**/*.integration.test.ts'],
          testTimeout: 30000,
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['**/*.browser.test.ts'],
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          benchmark: { exclude: ['**/*'] },
        },
      },
      {
        extends: true,
        test: {
          name: 'bench',
          include: ['**/*.{bench,benchmark}.ts'],
          benchmark: { include: ['**/*.{bench,benchmark}.ts'] },
        },
      },
    ],
  },
});
