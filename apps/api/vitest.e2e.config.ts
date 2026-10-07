import { existsSync } from 'node:fs';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');

// Integration tests always run against the dedicated test database, never the development one.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://probuild:probuild@localhost:5435/probuild_test?schema=public';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      WEB_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      SESSION_TTL_HOURS: '12',
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
