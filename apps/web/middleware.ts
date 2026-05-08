import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

const intlMiddleware = createMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localePrefix: 'as-needed'
});

const PROTECTED_PATHS = [
  '/dashboard', '/family', '/children', '/subjects', '/curriculums',
  '/planner', '/calendar', '/projects', '/resources',
  '/notes', '/progress', '/assistant', '/community', '/settings'
];

function splitLocale(pathname: string): { locale: string | null; rest: string } {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return { locale, rest: '/' };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: null, rest: pathname };
}

function withLocalePrefix(path: string, locale: string | null): string {
  if (!locale || locale === defaultLocale) return path;
  return `/${locale}${path === '/' ? '' : path}`;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);
  const hasToken = request.cookies.has('access_token');

  // Authenticated user visiting root → redirect to dashboard
  if (rest === '/' && hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix('/dashboard', locale);
    return NextResponse.redirect(url);
  }

  // Protected route without token → redirect to login
  const isProtected = PROTECTED_PATHS.some(
    p => rest === p || rest.startsWith(p + '/')
  );
  if (isProtected && !hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix('/login', locale);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
