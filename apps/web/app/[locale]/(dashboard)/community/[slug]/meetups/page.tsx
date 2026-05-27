'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Calendar, Globe2, MapPin, Loader2, Plus } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link } from '../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../lib/apiFetch';
import { CommunityTabs } from '../../../../../../components/community/CommunityTabs';
import type { CommunityDetail, MeetupOccurrence } from '../../../../../../components/community/types';


function formatWhen(starts_at: string, duration: number): string {
  const d = new Date(starts_at);
  const end = new Date(d.getTime() + duration * 60_000);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  return `${dateStr} · ${timeStr}`;
}


export default function MeetupsListPage() {
  const t = useTranslations('Meetups');
  const tIndex = useTranslations('Community');
  const params = useParams();
  const slug = params.slug as string;
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [items, setItems] = useState<MeetupOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  async function reload() {
    const today = new Date();
    const from = new Date(showPast ? today.getTime() - 56 * 86_400_000 : today.getTime() - 86_400_000)
      .toISOString().slice(0, 10);
    const to = new Date(showPast ? today.getTime() - 86_400_000 : today.getTime() + 56 * 86_400_000)
      .toISOString().slice(0, 10);

    const [c, m] = await Promise.all([
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/meetups?window_from=${from}&window_to=${to}`)
        .then((r) => (r.ok ? r.json() : { items: [] })),
    ]);
    setCommunity(c);
    setItems(m.items);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, showPast]);

  async function rsvp(item: MeetupOccurrence, response: 'going' | 'maybe' | 'not_going') {
    const key = `${item.meetup_id}-${item.occurrence_date}`;
    setActingKey(key);
    try {
      await apiFetch(
        `/api/v1/communities/${encodeURIComponent(slug)}/meetups/${item.meetup_id}/rsvp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occurrence_date: item.occurrence_date, response }),
        },
      );
      await reload();
    } finally {
      setActingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!community) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Not available.
      </p>
    );
  }

  const canSettings = community.viewer_role === 'admin' || community.viewer_role === 'co_admin';

  return (
    <div className="max-w-5xl">
      <Link href={`/community/${slug}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {community.name}
      </Link>

      <CommunityTabs slug={slug} canSettings={canSettings} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setShowPast(false)}
              className={`px-3 py-1.5 ${!showPast ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {t('tabUpcoming')}
            </button>
            <button
              onClick={() => setShowPast(true)}
              className={`px-3 py-1.5 ${showPast ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {t('tabPast')}
            </button>
          </div>
          <Link href={`/community/${slug}/meetups/new`}>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> {t('newMeetup')}
            </Button>
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          {showPast ? t('emptyPast') : t('emptyUpcoming')}
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {items.map((item) => {
            const key = `${item.meetup_id}-${item.occurrence_date}`;
            return (
              <div key={key} className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <Link
                    href={`/community/${slug}/meetups/${item.meetup_id}`}
                    className="min-w-0 flex-1"
                  >
                    <h3 className="text-base font-semibold text-slate-800">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatWhen(item.starts_at, item.duration_minutes)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      {item.meeting_url
                        ? <><Globe2 className="w-3.5 h-3.5" /> {t('details.online')}</>
                        : <><MapPin className="w-3.5 h-3.5" /> {item.location_text}</>}
                    </p>
                  </Link>
                  <div className="text-xs text-slate-500 shrink-0">
                    {t('rsvpCounts', { going: item.rsvp_counts.going, maybe: item.rsvp_counts.maybe })}
                  </div>
                </div>
                <div className="mt-3 inline-flex border border-slate-200 rounded-lg overflow-hidden text-xs">
                  {(['going', 'maybe', 'not_going'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => rsvp(item, r)}
                      disabled={actingKey === key}
                      className={`px-3 py-1.5 ${item.viewer_rsvp === r ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {r === 'going' ? t('rsvpGoing') : r === 'maybe' ? t('rsvpMaybe') : t('rsvpNot')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
