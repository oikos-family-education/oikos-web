/**
 * Unit tests for apps/web/middleware.ts
 *
 * We mock the two external dependencies so we can exercise our own logic
 * (cookie guard + locale stripping) in pure jsdom without Next.js edge runtime.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stub next-intl middleware ───────────────────────────────────────────────
// We just return the request untouched — we only want to verify our guard logic.
vi.mock('next-intl/middleware', () => ({
  default: () => (req: unknown) => ({ type: 'intl', req }),
}));

// ── Stub i18n config (locales + defaultLocale used by middleware) ─────────
vi.mock('../i18n', () => ({ locales: ['en', 'pt-BR'], defaultLocale: 'en' }));

// ── Minimal NextRequest / NextResponse stubs ───────────────────────────────
const mockRedirectResponse = { type: 'redirect' as const };
const mockNextResponse = { type: 'next' as const };
const mockForbiddenResponse = { type: 'forbidden' as const };

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
    headers: { get: (k: string) => string | null };
    constructor(url: string, opts: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
      this.nextUrl = new MockURL(url);
      const jar = opts.cookies ?? {};
      this.cookies = { has: (k) => k in jar };
      const headers = Object.fromEntries(
        Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
      );
      this.headers = { get: (k) => headers[k.toLowerCase()] ?? null };
    }
  }

  // The middleware builds a 403 with `new NextResponse(body, { status: 403 })`.
  class NextResponse {
    constructor(_body?: unknown, init?: { status?: number }) {
      if (init?.status === 403) return mockForbiddenResponse as unknown as NextResponse;
    }
    static redirect(_url: unknown) { return mockRedirectResponse; }
    static next() { return mockNextResponse; }
  }

  return { NextRequest, NextResponse };
});

// ── Import AFTER mocks are set up ──────────────────────────────────────────
import { NextRequest } from 'next/server';

// We re-import middleware after all mocks
import middleware from '../middleware';

// ── Helper ─────────────────────────────────────────────────────────────────
function makeReq(
  pathname: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return new (NextRequest as any)(`http://localhost${pathname}`, { cookies, headers });
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

  describe('/api/* in cloud mode', () => {
    it('passes /api/v1/auth/me straight through (no auth redirect, no intl)', () => {
      const res = middleware(makeReq('/api/v1/auth/me') as any);
      expect(res).toMatchObject({ type: 'next' });
    });

    it('passes a protected-looking api path through without a token', () => {
      const res = middleware(makeReq('/api/dashboard') as any);
      expect(res).toMatchObject({ type: 'next' });
    });

    it('does not apply the host allowlist', () => {
      const res = middleware(makeReq('/api/v1/health', {}, { host: 'evil.example' }) as any);
      expect(res).toMatchObject({ type: 'next' });
    });

    it('leaves page requests with a foreign Host untouched', () => {
      const res = middleware(makeReq('/login', {}, { host: 'evil.example' }) as any);
      expect(res).toMatchObject({ type: 'intl' });
    });
  });

  describe('desktop host allowlist', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('rejects a page request with a foreign Host', () => {
      const res = middleware(makeReq('/login', {}, { host: 'evil.example' }) as any);
      expect(res).toMatchObject({ type: 'forbidden' });
    });

    it('rejects an /api request with a foreign Host', () => {
      const res = middleware(makeReq('/api/v1/auth/me', {}, { host: 'evil.example' }) as any);
      expect(res).toMatchObject({ type: 'forbidden' });
    });

    it('rejects a request with the right host but a different port', () => {
      const res = middleware(makeReq('/login', {}, { host: '127.0.0.1:3000' }) as any);
      expect(res).toMatchObject({ type: 'forbidden' });
    });

    it('rejects a request with no Host header', () => {
      const res = middleware(makeReq('/login') as any);
      expect(res).toMatchObject({ type: 'forbidden' });
    });

    for (const host of ['127.0.0.1:47321', 'localhost:47321']) {
      it(`lets ${host} reach pages (normal logic applies)`, () => {
        expect(middleware(makeReq('/login', {}, { host }) as any)).toMatchObject({ type: 'intl' });
        expect(middleware(makeReq('/dashboard', {}, { host }) as any)).toMatchObject({ type: 'redirect' });
        expect(middleware(makeReq('/dashboard', { access_token: 't' }, { host }) as any)).toMatchObject({ type: 'intl' });
      });

      it(`lets ${host} reach /api straight through`, () => {
        expect(middleware(makeReq('/api/v1/auth/me', {}, { host }) as any)).toMatchObject({ type: 'next' });
      });
    }
  });
});
