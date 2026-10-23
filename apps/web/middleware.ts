import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';
import { isDesktop } from './lib/appMode';

const intlMiddleware = createMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localePrefix: 'as-needed'
});

const PROTECTED_PATHS = [
  '/dashboard', '/family', '/children', '/subjects', '/curriculums',
  '/planner', '/calendar', '/projects', '/lessons', '/resources',
  '/notes', '/progress', '/assistant', '/community', '/discover', '/messages', '/settings'
];

// The desktop app only ever serves its own window, on this fixed port.
const DESKTOP_ALLOWED_HOSTS = ['127.0.0.1:47321', 'localhost:47321'];

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

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

  // Desktop host allowlist (DNS-rebinding defence). Next's /api rewrite proxy
  // replaces the Host header, so the API can't check the browser's own Host;
  // this is the only place it is visible, hence /api/* is in the matcher.
  if (isDesktop() && !DESKTOP_ALLOWED_HOSTS.includes(request.headers.get('host') ?? '')) {
    return new NextResponse(null, { status: 403 });
  }

  // API requests are proxied to FastAPI by next.config.js rewrites: no locale
  // handling and no auth redirect here.
  if (isApiPath(pathname)) {
    return NextResponse.next();
  }

  const { locale, rest } = splitLocale(pathname);
  // Cookie presence is a hint, not proof of a valid session. AuthProvider
  // verifies via /me and handles the real auth-state branching.
  const hasToken =
    request.cookies.has('access_token') || request.cookies.has('refresh_token');

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
  // /api/* is matched only so the desktop host allowlist can see it; in cloud
  // mode the middleware passes those requests straight through.
  matcher: ['/api/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
