'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface DiscoverFilterValues {
  country: string;
  region: string;
  faith: string;
  denomination: string;
  methods: string[];
  languages: string[];
}

interface Props {
  value: DiscoverFilterValues;
  onChange: (next: DiscoverFilterValues) => void;
}

const FAITHS = ['christian', 'jewish', 'muslim', 'secular', 'other', 'none'];
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

export function DiscoverFilters({ value, onChange }: Props) {
  const t = useTranslations('Discover');

  function toggleArr(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 sticky top-0 z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('filterCountry')} <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value, region: '' })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">{t('filterRegion')}</label>
          <input
            type="text"
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value })}
            placeholder={t('filterAny')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">{t('filterFaith')}</label>
          <select
            value={value.faith}
            onChange={(e) => onChange({ ...value, faith: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('filterAny')}</option>
            {FAITHS.map((f) => (
              <option key={f} value={f} className="capitalize">{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">{t('filterDenomination')}</label>
          <input
            type="text"
            value={value.denomination}
            onChange={(e) => onChange({ ...value, denomination: e.target.value })}
            placeholder={t('filterAny')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('filterMethods')}</label>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...value, methods: toggleArr(value.methods, m) })}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                value.methods.includes(m)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {m.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('filterLanguages')}</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ ...value, languages: toggleArr(value.languages, l) })}
              className={`text-xs px-3 py-1 rounded-full border uppercase transition-colors ${
                value.languages.includes(l)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
