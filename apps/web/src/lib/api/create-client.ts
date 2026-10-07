import createClient, { type Middleware } from 'openapi-fetch';
import type { WebPaths } from './contract';

export type WebClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  onUnauthorized?: () => void;
};

/** Mirrors `createApiClient` from @probuild/api-client, typed with the local response contract. */
export function createWebClient(options: WebClientOptions) {
  const client = createClient<WebPaths>({
    baseUrl: options.baseUrl,
    credentials: 'include',
    ...(options.headers ? { headers: options.headers } : {}),
  });
  const middleware: Middleware = {
    onRequest({ request }) {
      request.headers.set('x-request-id', crypto.randomUUID());
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) options.onUnauthorized?.();
      return response;
    },
  };
  client.use(middleware);
  return client;
}

export type WebClient = ReturnType<typeof createWebClient>;
