import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'tests/authorization/**/*.test.ts',
      'tests/retention/**/*.test.ts',
      'tests/terms/**/*.integration.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
