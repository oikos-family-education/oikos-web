'use client';

import React, { useState } from 'react';
import { useRouter } from '../../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@oikos/ui';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from '../../../../../lib/navigation';
import { apiFetch } from '../../../../../lib/apiFetch';

const FAITHS = ['', 'christian', 'jewish', 'muslim', 'secular', 'other', 'none'];
const METHODS = [
  'classical', 'charlotte_mason', 'montessori', 'unschooling',
  'structured', 'eclectic', 'waldorf', 'unit_study', 'online', 'other',
];
const LANGUAGES = ['en', 'es', 'pt', 'fr', 'de', 'it', 'nl'];
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'ZA', name: 'South Africa' },
];

export default function NewCommunityPage() {
  const t = useTranslations('Community.create');
  const tErr = useTranslations('Community.errors');
  const tIndex = useTranslations('Community');
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [principlesText, setPrinciplesText] = useState('');
  const [faith, setFaith] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [regionScope, setRegionScope] = useState<'online' | 'country' | 'country_region'>('country_region');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [joinMode, setJoinMode] = useState<'request_to_join' | 'invite_only'>('request_to_join');
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleArr(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  async function submit() {
    setError(null);
    if (regionScope !== 'online' && !country) {
      setError(t('regionRequired'));
      return;
    }
    if (regionScope === 'country_region' && !region) {
      setError(t('regionDetailRequired'));
      return;
    }
    const lo = ageMin === '' ? null : Number(ageMin);
    const hi = ageMax === '' ? null : Number(ageMax);
    if (lo !== null && hi !== null && lo > hi) {
      setError(t('ageRangeInverted'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline: tagline || null,
          description,
          principles_text: principlesText,
          principle_tags: { faith: faith || null, education_methods: methods, home_languages: languages },
          region_scope: regionScope,
          country_code: regionScope === 'online' ? null : country,
          region: regionScope === 'country_region' ? region : null,
          join_mode: joinMode,
          child_age_min: lo,
          child_age_max: hi,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/community/${data.slug}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || tErr('generic'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/community" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {tIndex('indexTitle')}
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('title')}</h1>
        <div className="flex gap-2 text-xs text-slate-500 mb-6">
          <span className={step === 1 ? 'text-primary font-semibold' : ''}>1. {t('stepIdentity')}</span>
          <span>·</span>
          <span className={step === 2 ? 'text-primary font-semibold' : ''}>2. {t('stepPrinciples')}</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Input
              label={t('name')}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={60}
            />
            <Input
              label={t('tagline')}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={t('taglinePlaceholder')}
              maxLength={140}
            />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t('description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t('descriptionPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" disabled={!name.trim()} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t('principlesText')}</label>
              <textarea
                value={principlesText}
                onChange={(e) => setPrinciplesText(e.target.value)}
                rows={6}
                maxLength={4000}
                placeholder={t('principlesPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t('principleTagsFaith')}</label>
              <select
                value={faith}
                onChange={(e) => setFaith(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FAITHS.map((f) => (
                  <option key={f} value={f}>{f || '—'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('principleTagsMethods')}</label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethods((prev) => toggleArr(prev, m))}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      methods.includes(m)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {m.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('principleTagsLanguages')}</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguages((prev) => toggleArr(prev, l))}
                    className={`text-xs px-3 py-1 rounded-full border uppercase ${
                      languages.includes(l)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('regionScope')} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['online', 'country', 'country_region'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRegionScope(s)}
                    className={`text-sm px-3 py-2 rounded-lg border text-center capitalize ${
                      regionScope === s
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {regionScope !== 'online' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {t('country')} <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">—</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {regionScope === 'country_region' && (
              <Input
                label={t('region')}
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                maxLength={100}
              />
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('joinMode')} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setJoinMode('request_to_join')}
                  className={`text-left px-3 py-2 rounded-lg border text-sm ${
                    joinMode === 'request_to_join' ? 'bg-primary/10 border-primary' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="font-semibold text-slate-800">Request to join</div>
                  <div className="text-xs text-slate-500">{t('joinModeRequestDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setJoinMode('invite_only')}
                  className={`text-left px-3 py-2 rounded-lg border text-sm ${
                    joinMode === 'invite_only' ? 'bg-primary/10 border-primary' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="font-semibold text-slate-800">Invite-only</div>
                  <div className="text-xs text-slate-500">{t('joinModeInviteDesc')}</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {t('ageRangeLabel')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  placeholder={t('ageMin')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  placeholder={t('ageMax')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('ageRangeHelp')}</p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Back
              </button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('submit')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
