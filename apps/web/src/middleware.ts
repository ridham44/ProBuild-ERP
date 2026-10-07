import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'pb_session';
const PUBLIC_PATHS = ['/login', '/reset-password'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Cheap gate: no session cookie means no point rendering a protected page. The cookie may still be
 * expired or revoked; the API is the authority and the app layout redirects on a 401.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('x-pathname', `${pathname}${search}`);

  if (!isPublic(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\..*).*)'],
};
