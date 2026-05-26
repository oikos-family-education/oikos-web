'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { COUNTRIES } from '../../lib/countries';

export interface CommunityFilterValues {
  country: string;
  region: string;
  faith: string;
  ageMin: string;
  ageMax: string;
}

interface Props {
  value: CommunityFilterValues;
  onChange: (next: CommunityFilterValues) => void;
}

const FAITHS = ['', 'christian', 'jewish', 'muslim', 'secular', 'other', 'none'];

/**
 * Inline filter bar on the /community index page. Mirrors the shape of the
 * `GET /api/v1/communities` query params (country, region, faith, age_min,
 * age_max). The parent page is responsible for pre-selecting the family's own
 * country before mounting this component.
 */
export function CommunityFilters({ value, onChange }: Props) {
  const t = useTranslations('Community.filters');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label htmlFor="cf-country" className="block text-xs font-semibold text-slate-600 mb-1">{t('country')}</label>
          <select
            id="cf-country"
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value, region: '' })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('any')}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cf-region" className="block text-xs font-semibold text-slate-600 mb-1">{t('region')}</label>
          <input
            id="cf-region"
            type="text"
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value })}
            placeholder={t('any')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="cf-faith" className="block text-xs font-semibold text-slate-600 mb-1">{t('faith')}</label>
          <select
            id="cf-faith"
            value={value.faith}
            onChange={(e) => onChange({ ...value, faith: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {FAITHS.map((f) => (
              <option key={f} value={f}>{f || t('any')}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cf-age-min" className="block text-xs font-semibold text-slate-600 mb-1">{t('ageFrom')}</label>
          <input
            id="cf-age-min"
            type="number"
            min={0}
            max={25}
            value={value.ageMin}
            onChange={(e) => onChange({ ...value, ageMin: e.target.value })}
            placeholder={t('any')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="cf-age-max" className="block text-xs font-semibold text-slate-600 mb-1">{t('ageTo')}</label>
          <input
            id="cf-age-max"
            type="number"
            min={0}
            max={25}
            value={value.ageMax}
            onChange={(e) => onChange({ ...value, ageMax: e.target.value })}
            placeholder={t('any')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  );
}
