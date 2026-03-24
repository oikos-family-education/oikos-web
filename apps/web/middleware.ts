import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales } from './i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en'
});

const PROTECTED_PATHS = [
  '/dashboard', '/family', '/children', '/subjects', '/curriculums',
  '/planner', '/calendar', '/projects', '/resources',
  '/journal', '/progress', '/assistant', '/community', '/settings'
];

function getPathnameWithoutLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
    if (pathname === `/${locale}`) {
      return '/';
    }
  }
  return pathname;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = getPathnameWithoutLocale(pathname);
  const hasToken = request.cookies.has('access_token');

  // Authenticated user visiting root → redirect to dashboard
  if (pathWithoutLocale === '/' && hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/en/dashboard';
    return NextResponse.redirect(url);
  }

  // Protected route without token → redirect to login
  const isProtected = PROTECTED_PATHS.some(
    p => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + '/')
  );
  if (isProtected && !hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/en/login';
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
