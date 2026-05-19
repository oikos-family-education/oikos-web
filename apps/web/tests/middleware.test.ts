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

// ── Stub i18n config (locales + defaultLocale used by middleware) ─────────
vi.mock('../i18n', () => ({ locales: ['en', 'pt-BR'], defaultLocale: 'en' }));

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
import { NextRequest } from 'next/server';

// We re-import middleware after all mocks
import middleware from '../middleware';

// ── Helper ─────────────────────────────────────────────────────────────────
function makeReq(pathname: string, cookies: Record<string, string> = {}) {
  return new (NextRequest as any)(`http://localhost${pathname}`, { cookies });
}

describe('middleware', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('locale stripping (internal logic)', () => {
    it('recognises a protected path under a non-default locale prefix', () => {
      // /pt-BR/dashboard should be recognised as /dashboard for the protected check.
      const req = makeReq('/pt-BR/dashboard');         // no token
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'redirect' });
    });

    it('passes non-protected localised paths through to intl middleware', () => {
      const req = makeReq('/pt-BR/login');
      const res = middleware(req as any);
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

  describe('landing page', () => {
    it('passes / through to intl middleware when user has access_token', () => {
      // Landing page is reachable for everyone — cookie presence isn't proof of
      // a valid session, so we don't bounce to /dashboard from middleware.
      const req = makeReq('/', { access_token: 'tok' });
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });

    it('passes /pt-BR through to intl middleware when user has access_token', () => {
      const req = makeReq('/pt-BR', { access_token: 'tok' });
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });

    it('passes / to intl middleware when no access_token', () => {
      const req = makeReq('/');
      const res = middleware(req as any);
      expect(res).toMatchObject({ type: 'intl' });
    });
  });
});
