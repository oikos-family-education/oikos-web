/**
 * Shared API client with automatic credential inclusion, single-flight refresh,
 * and redirect-to-login on unrecoverable 401.
 *
 * Use this for every call to /api/v1/* (except inside AuthProvider, which owns
 * the explicit /me + /refresh dance for the initial session handshake).
 *
 * On 401:
 *   1. Skip refresh attempts for /api/v1/auth/* — those endpoints own the
 *      session lifecycle and should surface 401 to their callers (e.g. wrong
 *      password on login).
 *   2. Otherwise, try a single-flight POST /api/v1/auth/refresh.
 *   3. If refresh succeeds, retry the original request once and return that
 *      response.
 *   4. If refresh fails, redirect to /login and return the original 401 so
 *      callers don't have to special-case it.
 */

const REFRESH_URL = '/api/v1/auth/refresh';
const LOGIN_PATH = '/login';

let refreshInFlight: Promise<boolean> | null = null;

function isAuthEndpoint(url: string): boolean {
  // /api/v1/auth/* owns the session lifecycle — don't intercept its 401s.
  return url.includes('/api/v1/auth/');
}

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(REFRESH_URL, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.endsWith(LOGIN_PATH)) return;
  window.location.href = LOGIN_PATH;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const opts: RequestInit = { credentials: 'include', ...init };
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const res = await fetch(input, opts);
  if (res.status !== 401) return res;
  if (isAuthEndpoint(url)) return res;

  const refreshed = await attemptRefresh();
  if (!refreshed) {
    redirectToLogin();
    return res;
  }
  return fetch(input, opts);
}
