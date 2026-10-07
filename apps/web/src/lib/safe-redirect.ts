const AUTH_PAGES = ['/login', '/reset-password'];

/** Accepts only same-origin relative paths so a crafted `next` parameter cannot send users elsewhere. */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (
    AUTH_PAGES.some(
      (page) => value === page || value.startsWith(`${page}?`) || value.startsWith(`${page}/`),
    )
  )
    return fallback;
  return value;
}
