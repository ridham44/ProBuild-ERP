import { createWebClient } from './create-client';

export function apiBaseUrl(): string {
  return process.env.API_URL ?? 'http://localhost:4000';
}

/** Server-side client that forwards the browser's session cookie to the API. */
export function createServerApi(cookieHeader: string) {
  return createWebClient({ baseUrl: apiBaseUrl(), headers: { cookie: cookieHeader } });
}
