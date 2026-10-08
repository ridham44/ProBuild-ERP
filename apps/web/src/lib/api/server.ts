import { createWebClient } from './create-client';

export function apiBaseUrl(): string {
  // On Vercel, API_URL is injected by the service binding; the base URL may end with a slash.
  return (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

/** Server-side client that forwards the browser's session cookie to the API. */
export function createServerApi(cookieHeader: string) {
  return createWebClient({ baseUrl: apiBaseUrl(), headers: { cookie: cookieHeader } });
}
