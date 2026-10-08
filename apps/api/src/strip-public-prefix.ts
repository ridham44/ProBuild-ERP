const PUBLIC_PREFIX = '/api';

/**
 * On Vercel the public route is /api/*, and the original path is passed through to the function.
 * The app itself serves /v1/* and /health, so the prefix is removed before Express sees the request.
 */
export function stripPublicPrefix(url: string | undefined): string | undefined {
  if (!url) return url;
  const isPrefixed = url === PUBLIC_PREFIX || url.startsWith(`${PUBLIC_PREFIX}/`) || url.startsWith(`${PUBLIC_PREFIX}?`);
  if (!isPrefixed) return url;
  const rest = url.slice(PUBLIC_PREFIX.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}
