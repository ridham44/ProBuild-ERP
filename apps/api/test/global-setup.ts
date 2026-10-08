import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Applies every migration to the test database once before the suite runs. */
export default function setup(): void {
  if (existsSync('../../.env')) process.loadEnvFile('../../.env');
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://probuild:probuild@localhost:5435/probuild_test?schema=public';
  if (!url.includes('probuild_test')) {
    throw new Error('Refusing to run integration tests: TEST_DATABASE_URL must point at the probuild_test database');
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: true,
  });
}
