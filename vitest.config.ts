import { playwright } from '@vitest/browser-playwright';
import circularDependency from 'vite-plugin-circular-dependency';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [circularDependency()],
  test: {
    globals: true,
    environment: 'happy-dom',
    projects: [
      {
        extends: true,
        test: {
          name: 'common',
          include: [
            './src/**/*.test.ts',
            '!./src/**/*.{node,browser}.test.ts',
          ],
          // environment: 'happy-dom',
          // setupFiles: ['./src/shared/libs/formula/testing-library/bootstrap.ts', './src/shared/libs/formula/testing-library/matchers.ts', './vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['**/*.node.test.ts'],
          environment: 'node',
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
        },
      },
    ],
  },
});
