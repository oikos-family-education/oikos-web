'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface Props {
  slug: string;
  initialMuted: boolean;
}

export function MuteToggle({ slug, initialMuted }: Props) {
  const t = useTranslations('Notifications');
  const [muted, setMuted] = useState(initialMuted);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/mute`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: !muted }),
      });
      if (res.ok) {
        const data = await res.json();
        setMuted(data.muted);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
      title={muted ? t('unmuted') : t('muteThisCommunity')}
    >
      {muted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
      {muted ? t('muted') : t('muteThisCommunity')}
    </button>
  );
}
