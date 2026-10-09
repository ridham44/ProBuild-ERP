import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'pb_session';
const PUBLIC_PATHS = ['/home', '/login', '/reset-password'];

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
    url.search = '';
    // Signed-out visitors to the root see the public home page; deep links go to sign-in and come back.
    url.pathname = pathname === '/' ? '/home' : '/login';
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

// Vercel services do not support the Edge runtime, so the middleware runs on Node.js (stable since Next.js 15.5).
export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\..*).*)'],
};
