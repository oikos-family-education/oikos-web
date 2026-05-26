'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, X } from 'lucide-react';
import { Button } from '@oikos/ui';
import { apiFetch } from '../../lib/apiFetch';

const DISMISS_KEY = 'oikos-discoverable-banner-dismissed';

/**
 * Inline banner shown on the dashboard until the family explicitly chooses
 * whether to be discoverable. Driven by the family's `discoverable` flag and a
 * local-storage "dismissed" hint so it doesn't reappear after the user closes it.
 */
export function DiscoverableBanner() {
  const t = useTranslations('Discover');
  const [show, setShow] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const dismissed = typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === 'true';
        if (dismissed) return;
        const res = await apiFetch('/api/v1/families/me');
        if (!res.ok) return;
        const fam = await res.json();
        if (fam.discoverable === false) setShow(true);
      } catch {
        /* swallow — banner is purely opportunistic */
      }
    })();
  }, []);

  async function choose(discoverable: boolean) {
    setActing(true);
    try {
      await apiFetch('/api/v1/families/me/discoverable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoverable }),
      });
      window.localStorage.setItem(DISMISS_KEY, 'true');
      setShow(false);
    } finally {
      setActing(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4 relative">
      <div className="inline-flex p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
        <Compass className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-slate-800 mb-1">{t('discoverableBannerTitle')}</h3>
        <p className="text-sm text-slate-600 mb-3">{t('discoverableBannerBody')}</p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => choose(true)} disabled={acting}>
            {t('discoverableBannerYes')}
          </Button>
          <button
            onClick={() => choose(false)}
            disabled={acting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2"
          >
            {t('discoverableBannerNo')}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-slate-400 hover:text-slate-600 absolute top-3 right-3"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
