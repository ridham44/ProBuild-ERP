import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './bootstrap';
import { stripPublicPrefix } from './strip-public-prefix';

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

let server: Promise<RequestListener> | undefined;

async function boot(): Promise<RequestListener> {
  const app = await createApp({ abortOnError: false });
  await app.init();
  return app.getHttpAdapter().getInstance() as RequestListener;
}

/** Vercel function entry: the Nest app is built once per warm instance and reused across requests. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // A failed boot must not be cached, or every later request on this instance would fail too.
  server ??= boot().catch((error: unknown) => {
    server = undefined;
    throw error;
  });
  req.url = stripPublicPrefix(req.url);
  (await server)(req, res);
}
