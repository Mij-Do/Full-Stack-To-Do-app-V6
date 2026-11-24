import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['react-server', 'node'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
