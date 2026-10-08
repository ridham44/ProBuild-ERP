import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// One shared .env at the repository root; Prisma's CLI only auto-loads .env next to the package.
const rootEnv = path.resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: path.join('prisma', 'schema'),
});
