'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft, Globe2, MapPin, Lock, Users, LogOut } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link } from '../../../../../lib/navigation';
import { apiFetch } from '../../../../../lib/apiFetch';
import { CommunityTabs } from '../../../../../components/community/CommunityTabs';
import { MarkdownLite } from '../../../../../components/community/MarkdownLite';
import type { CommunityDetail } from '../../../../../components/community/types';

export default function CommunityOverviewPage() {
  const t = useTranslations('Community');
  const tOv = useTranslations('Community.overview');
  const params = useParams();
  const slug = params.slug as string;
  const [c, setC] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function reload() {
    const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`);
    if (res.ok) setC(await res.json());
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function join() {
    setActing(true);
    try {
      await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/join`, { method: 'POST' });
      await reload();
    } finally {
      setActing(false);
    }
  }

  async function leave() {
    if (!confirm(tOv('leave') + '?')) return;
    setActing(true);
    try {
      await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/leave`, { method: 'POST' });
      await reload();
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="max-w-3xl">
        <Link href="/community" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('indexTitle')}
        </Link>
        <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
          Community not found.
        </p>
      </div>
    );
  }

  const isMember = c.viewer_status === 'active';
  const canSettings = c.viewer_role === 'admin' || c.viewer_role === 'co_admin';

  return (
    <div className="max-w-5xl">
      <Link href="/community" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t('indexTitle')}
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-800">{c.name}</h1>
          <div className="flex gap-2">
            {!isMember && c.viewer_status !== 'pending' && c.join_mode === 'request_to_join' && (
              <Button onClick={join} disabled={acting}>
                {acting ? tOv('joining') : tOv('requestToJoin')}
              </Button>
            )}
            {c.viewer_status === 'pending' && (
              <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                {tOv('requestPending')}
              </span>
            )}
            {isMember && (
              <button
                onClick={leave}
                disabled={acting}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
              >
                <LogOut className="w-4 h-4" />
                {tOv('leave')}
              </button>
            )}
          </div>
        </div>

        {c.tagline && <p className="text-slate-600 mb-3">{c.tagline}</p>}

        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
          <span className="inline-flex items-center gap-1">
            {c.region_scope === 'online' ? <Globe2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
            {t(`regionScope.${c.region_scope}`)}
            {c.country_code && c.region_scope !== 'online' && (
              <span>· {c.region ?? c.country_code}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            {c.join_mode === 'invite_only' && <Lock className="w-3.5 h-3.5" />}
            {t(`joinMode.${c.join_mode}`)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {t('memberCount', { count: c.member_count })}
          </span>
        </div>

        {!isMember && (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 mb-4">{tOv('memberOnly')}</p>
        )}
      </div>

      {isMember && <CommunityTabs slug={slug} canSettings={canSettings} />}

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{tOv('description')}</h2>
        {c.description ? <MarkdownLite source={c.description} /> : <p className="text-sm text-slate-500">No description.</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{tOv('principles')}</h2>
        {c.principles_text ? <MarkdownLite source={c.principles_text} /> : <p className="text-sm text-slate-500">—</p>}
      </div>
    </div>
  );
}
