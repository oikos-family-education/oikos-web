/**
 * Admin app API client. Independent of the regular web app's session.
 *
 * On 401, redirects to /login. There is no silent refresh — admin sessions
 * are short (4 hours) and re-auth is intentional.
 */

const LOGIN_PATH = '/login';

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === LOGIN_PATH) return;
  window.location.href = LOGIN_PATH;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const opts: RequestInit = { credentials: 'include', ...init };
  const res = await fetch(input, opts);
  if (res.status === 401 && !String(input).includes('/api/v1/admin/auth/')) {
    redirectToLogin();
  }
  return res;
}
