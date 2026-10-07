import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { createApp, mountSwagger } from './bootstrap';
import { AppConfig } from './config/config.service';

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const app = await createApp();
  mountSwagger(app);
  await app.listen(app.get(AppConfig).get('PORT'));
}

main().catch((error: unknown) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
