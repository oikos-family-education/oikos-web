import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../lib/apiFetch';

const ORIGINAL_LOCATION = window.location;

function setPathname(pathname: string) {
  // jsdom's window.location is read-only at the top level — replace it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, pathname, href: ORIGINAL_LOCATION.href },
    writable: true,
  });
}

beforeEach(() => {
  setPathname('/overview');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: ORIGINAL_LOCATION,
    writable: true,
  });
});

describe('apiFetch', () => {
  it('always sends credentials: include', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/v1/admin/families');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/families',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('preserves caller-provided init (method, headers, body)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/v1/admin/users/x/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'r' }),
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"reason":"r"}');
    expect(init.credentials).toBe('include');
  });

  it('redirects to /login on 401 for non-auth endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );

    await apiFetch('/api/v1/admin/families');
    expect(window.location.href).toBe('/login');
  });

  it('does NOT redirect on 401 for /api/v1/admin/auth/ endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );

    const before = window.location.href;
    await apiFetch('/api/v1/admin/auth/login', { method: 'POST' });
    expect(window.location.href).toBe(before);
  });

  it('does NOT redirect when already on /login', async () => {
    setPathname('/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );

    const before = window.location.href;
    await apiFetch('/api/v1/admin/families');
    expect(window.location.href).toBe(before);
  });

  it('does not redirect on non-401 errors (5xx, 403, 404)', async () => {
    for (const status of [403, 404, 500, 503]) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status })),
      );
      const before = window.location.href;
      const res = await apiFetch('/api/v1/admin/anything');
      expect(res.status).toBe(status);
      expect(window.location.href).toBe(before);
    }
  });

  it('returns the underlying Response object', async () => {
    const expected = new Response('{"ok":true}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(expected));
    const res = await apiFetch('/api/v1/admin/overview');
    expect(res).toBe(expected);
  });
});
