'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '../../../../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@oikos/ui';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from '../../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../../lib/apiFetch';


export default function NewMeetupPage() {
  const t = useTranslations('Meetups.form');
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState('60');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim() || !startsAt) return;
    if (!location.trim() && !url.trim()) {
      setError(t('needLocationOrUrl'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/meetups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: Number(duration) || 60,
          recurrence,
          recurrence_until: recurrenceUntil || null,
          location_text: location || null,
          meeting_url: url || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/community/${slug}/meetups/${data.id}`);
      } else {
        const b = await res.json().catch(() => ({}));
        setError(typeof b.detail === 'string' ? b.detail : 'Could not create meetup.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/community/${slug}/meetups`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Meetups
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <Input
          label={t('title')}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">{t('description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={4000}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {t('startsAt')} <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('duration')}</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('recurrence')}</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="none">{t('recurrenceNone')}</option>
              <option value="weekly">{t('recurrenceWeekly')}</option>
              <option value="biweekly">{t('recurrenceBiweekly')}</option>
              <option value="monthly">{t('recurrenceMonthly')}</option>
            </select>
          </div>
          {recurrence !== 'none' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t('recurrenceUntil')}</label>
              <input
                type="date"
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
        <Input
          label={t('location')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Sandymount Strand"
          maxLength={200}
        />
        <Input
          label={t('meetingUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          maxLength={500}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
