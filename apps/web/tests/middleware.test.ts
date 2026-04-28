/**
 * Unit tests for apps/web/middleware.ts
 *
 * We mock the two external dependencies so we can exercise our own logic
 * (cookie guard + locale stripping) in pure jsdom without Next.js edge runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stub next-intl middleware ───────────────────────────────────────────────
// We just return the request untouched — we only want to verify our guard logic.
vi.mock('next-intl/middleware', () => ({
  default: () => (req: unknown) => ({ type: 'intl', req }),
}));

// ── Stub i18n config (only `locales` is used by middleware) ────────────────
vi.mock('../i18n', () => ({ locales: ['en'] }));

// ── Minimal NextRequest / NextResponse stubs ───────────────────────────────
const mockRedirectResponse = { type: 'redirect' as const };

vi.mock('next/server', () => {
  class MockURL {
    pathname: string;
    constructor(base: string) {
      this.pathname = new URL(base).pathname;
    }
    clone() {
      const c = new MockURL(`http://localhost${this.pathname}`);
      return c;
    }
    toString() { return `http://localhost${this.pathname}`; }
  }

  class NextRequest {
    nextUrl: MockURL;
    cookies: { has: (k: string) => boolean };
    constructor(url: string, opts: { cookies?: Record<string, string> } = {}) {
      this.nextUrl = new MockURL(url);
      const jar = opts.cookies ?? {};
      this.cookies = { has: (k) => k in jar };
    }
  }

  const NextResponse = {
    redirect: (_url: unknown) => mockRedirectResponse,
  };

  return { NextRequest, NextResponse };
});

// ── Import AFTER mocks are set up ──────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// We re-import middleware after all mocks
import middleware from '../middleware';

// ── Helper ─────────────────────────────────────────────────────────────────
function makeReq(pathname: string, cookies: Record<string, string> = {}) {
  return new (NextRequest as any)(`http://localhost${pathname}`, { cookies });
}

describe('middleware', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getPathnameWithoutLocale (internal logic)', () => {
    it('removes /en/ prefix', () => {
      // By calling the middleware with a protected path under /en/ we verify
      // the locale-stripping works: /en/dashboard should be recognised as /dashboard.
      const req = makeReq('/en/dashboard');            // no token
      const res = middleware(req as any);
      // Middleware should redirect to login (protected, no token)
      expect(res).toMatchObject({ type: 'redirect' });
    });

    it('passes non-protected /en/ paths through to intl middleware', () => {
      const req = makeReq('/en/login');
      const res = middleware(req as any);
      // /login is not protected → intl middleware (type: 'intl')
      expect(res).toMatchObject({ type: 'intl' });
    });
  });

  describe('protected routes', () => {
    const PROTECTED = [
      '/dashboard', '/family', '/children', '/subjects',
      '/curriculums', '/planner', '/calendar', '/projects',
      '/resources', '/notes', '/progress',
    ];

    for (const path of PROTECTED) {
      it(`redirects ${path} to login when no access_token cookie`, () => {
        const req = makeReq(path);
        const res = middleware(req as any);
        expect(res).toMatchObject({ type: 'redirect' });
      });

      it(`passes ${path} through when access_token is present`, () => {
        const req = makeReq(path, { access_token: 'tok' });
        const res = middleware(req as any);
        // With token, guard passes → intl middleware
        expect(res).toMatchObject({ type: 'intl' });
      });
    }
  });

  describe('non-protected paths', () => {
    it('passes /login through without a token', () => {
      const req = makeReq('/login');
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });

    it('passes /register through without a token', () => {
      const req = makeReq('/register');
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });

    it('passes /forgot-password through without a token', () => {
      const req = makeReq('/forgot-password');
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });
  });

  describe('root redirect', () => {
    it('redirects / to /en/dashboard when user has access_token', () => {
      const req = makeReq('/', { access_token: 'tok' });
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'redirect' });
    });

    it('passes / to intl middleware when no access_token', () => {
      const req = makeReq('/');
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });
  });
});
