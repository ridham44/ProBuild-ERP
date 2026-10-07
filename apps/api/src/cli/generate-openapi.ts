import 'reflect-metadata';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOpenApiDocument, createApp } from '../bootstrap';

/** Boots the app without listening and writes the OpenAPI document used to generate the API client. */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const app = await createApp();
  await app.init();
  const out = resolve(__dirname, '../../../../packages/api-client/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(buildOpenApiDocument(app), null, 2));
  await app.close();
  console.log(`OpenAPI written to ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
