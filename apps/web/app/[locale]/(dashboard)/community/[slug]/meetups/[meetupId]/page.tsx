'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Calendar, Globe2, Loader2, MapPin, Trash2 } from 'lucide-react';
import { Link } from '../../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../../lib/apiFetch';
import { MarkdownLite } from '../../../../../../../components/community/MarkdownLite';
import type { MeetupDetail } from '../../../../../../../components/community/types';


function formatWhen(starts_at: string, duration: number): string {
  const d = new Date(starts_at);
  const end = new Date(d.getTime() + duration * 60_000);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `${dateStr} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}


export default function MeetupDetailPage() {
  const t = useTranslations('Meetups');
  const tDetails = useTranslations('Meetups.details');
  const params = useParams();
  const slug = params.slug as string;
  const meetupId = params.meetupId as string;

  const [m, setM] = useState<MeetupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(
        `/api/v1/communities/${encodeURIComponent(slug)}/meetups/${meetupId}`,
      );
      if (res.ok) setM(await res.json());
      setLoading(false);
    })();
  }, [slug, meetupId]);

  async function cancel() {
    if (!confirm('Cancel this meetup?')) return;
    setActing(true);
    try {
      await apiFetch(
        `/api/v1/communities/${encodeURIComponent(slug)}/meetups/${meetupId}/cancel`,
        { method: 'POST' },
      );
      const res = await apiFetch(
        `/api/v1/communities/${encodeURIComponent(slug)}/meetups/${meetupId}`,
      );
      if (res.ok) setM(await res.json());
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

  if (!m) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Meetup not found.
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/community/${slug}/meetups`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
      </Link>

      <article className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold text-slate-800">{m.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {tDetails('byAuthor', { family: m.created_by_family_name })}
          </p>
          {m.cancelled_at && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {tDetails('cancelled')}
            </span>
          )}
        </header>

        <div className="space-y-2 text-sm text-slate-600">
          <p className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formatWhen(m.starts_at, m.duration_minutes)}
          </p>
          {m.location_text && (
            <p className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {m.location_text}
            </p>
          )}
          {m.meeting_url && (
            <p className="inline-flex items-center gap-1.5">
              <Globe2 className="w-4 h-4" />
              <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {tDetails('openLink')}
              </a>
            </p>
          )}
        </div>

        {m.description && (
          <div className="pt-3 border-t border-slate-100">
            <MarkdownLite source={m.description} />
          </div>
        )}

        {!m.cancelled_at && (
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={cancel}
              disabled={acting}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {tDetails('cancel')}
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
