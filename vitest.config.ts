import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
  },
});
