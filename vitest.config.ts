import path from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import circularDependency from 'vite-plugin-circular-dependency';
import { defineConfig } from 'vitest/config';

// Benchmarks measure the built bundle: source modules pay for Vite's export getters on every call
const benchResolve = {
  alias: {
    evalex: path.resolve(import.meta.dirname, './packages/evalex/dist/index.js'),
  },
};

export default defineConfig({
  plugins: [circularDependency()],

  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './packages/evalex/src'),
      // A package reads another from its source, so tests run without a build
      'evalex/language': path.resolve(import.meta.dirname, './packages/evalex/src/language/index.ts'),
      'evalex': path.resolve(import.meta.dirname, './packages/evalex/src/index.ts'),
    },
  },

  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.(c|m)?[jt]s(x)?'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/index.ts'],
    },
    // Replaces the default exclude, so it names node_modules, where pnpm links each workspace package with its tests
    exclude: ['**/node_modules/**', '**/*.{bench,benchmark}.ts'],
    setupFiles: ['./packages/evalex/src/testing-library/setup.ts'],
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
          name: 'polyfill',
          include: ['**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/.git/**',
            '**/*.{browser,bench,benchmark,integration}.test.ts',
            '**/*.test-d.ts',
          ],
          setupFiles: ['./packages/evalex/src/testing-library/polyfill-temporal.ts'],
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
        resolve: benchResolve,
        test: {
          name: 'bench',
          include: ['**/*.{bench,benchmark}.ts'],
          benchmark: { include: ['**/*.{bench,benchmark}.ts'] },
        },
      },
      {
        extends: true,
        resolve: benchResolve,
        // Cross-origin isolation gives performance.now() 10 µs steps instead of 100 µs
        server: {
          headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
          },
        },
        test: {
          name: 'bench-browser',
          include: ['**/*.{bench,benchmark}.ts'],
          benchmark: { include: ['**/*.{bench,benchmark}.ts'] },
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
