'use client';

import { useEffect } from 'react';
import { useRouter } from '../../lib/navigation';
import { isDesktop } from '../../lib/appMode';

/**
 * Desktop-only, on the welcome page: the app opens here on every launch, so a parent who is
 * still logged in (the session survives a restart) goes straight to the dashboard.
 *
 * Asks the API rather than checking for cookies: after a restore the old cookies are stale,
 * and a cookie-based redirect would bounce the parent away from the Restore button.
 */
export function DesktopSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;

    async function check() {
      try {
        let me = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (me.status === 401) {
          // Access token expired: try the refresh token once
          const refresh = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
          if (!refresh.ok) return;
          me = await fetch('/api/v1/auth/me', { credentials: 'include' });
        }
        if (me.ok && !cancelled) router.replace('/dashboard');
      } catch {
        // Not logged in, or the API is unreachable: stay on the welcome page
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
