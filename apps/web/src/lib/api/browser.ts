import { createWebClient } from './create-client';

const PUBLIC_PATHS = ['/login', '/reset-password'];

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.assign(`/login?reason=expired&next=${next}`);
}

/** Browser client: same-origin `/api` is proxied to the API by next.config rewrites. */
export const api = createWebClient({ baseUrl: '/api', onUnauthorized: redirectToLogin });
