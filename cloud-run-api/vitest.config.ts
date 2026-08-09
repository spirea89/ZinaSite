import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
