import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    // Interaction tests drive real DOM events; under a parallel turbo run on a loaded machine
    // they exceed the 5s default, so allow headroom without changing what they assert.
    testTimeout: 20_000,
  },
});
