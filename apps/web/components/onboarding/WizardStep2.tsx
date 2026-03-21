'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import type { FamilyFormData } from './FamilyWizard';
import { Cross, Star, Moon, CircleDot } from 'lucide-react';

interface Props {
  data: FamilyFormData;
  onChange: (partial: Partial<FamilyFormData>) => void;
}

const FAITH_OPTIONS = [
  { value: 'christian', label: 'Christian', icon: '✝' },
  { value: 'jewish', label: 'Jewish', icon: '✡' },
  { value: 'muslim', label: 'Muslim', icon: '☪' },
  { value: 'secular', label: 'Secular / Non-religious', icon: '◯' },
  { value: 'other', label: 'Other', icon: '…' },
  { value: 'none', label: 'Prefer not to say', icon: '—' },
];

const DENOMINATIONS = [
  'Reformed / Presbyterian',
  'Catholic',
  'Baptist',
  'Anglican / Episcopalian',
  'Lutheran',
  'Methodist',
  'Pentecostal / Charismatic',
  'Eastern Orthodox',
  'Non-denominational',
  'Other',
];

export function WizardStep2({ data, onChange }: Props) {
  const t = useTranslations('Onboarding');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t('step2Heading')}</h2>
        <p className="text-slate-500 mt-1">{t('step2Sub')}</p>
      </div>

      {/* Faith Tradition Radio Cards */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('faithLabel')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FAITH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ faith_tradition: opt.value, faith_denomination: '', faith_community_name: '' })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                data.faith_tradition === opt.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl block mb-1">{opt.icon}</span>
              <span className="text-sm font-semibold text-slate-700">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Denomination (conditional) */}
      {data.faith_tradition === 'christian' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-sm font-semibold text-slate-700">{t('denominationLabel')}</label>
          <div className="grid grid-cols-2 gap-2">
            {DENOMINATIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ faith_denomination: d })}
                className={`p-3 text-sm rounded-lg border transition-all text-left ${
                  data.faith_denomination === d
                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Church / Faith Community */}
      {data.faith_tradition && !['secular', 'none'].includes(data.faith_tradition) && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <Input
            label={t('faithCommunityLabel')}
            placeholder={t('faithCommunityPlaceholder')}
            value={data.faith_community_name}
            onChange={(e) => onChange({ faith_community_name: e.target.value })}
            maxLength={120}
          />
        </div>
      )}

      {/* Worldview Notes */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('worldviewLabel')}</label>
        <textarea
          value={data.worldview_notes}
          onChange={(e) => onChange({ worldview_notes: e.target.value })}
          placeholder={t('worldviewPlaceholder')}
          maxLength={300}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none text-sm"
        />
        <div className="flex justify-between">
          <p className="text-xs text-slate-400">{t('worldviewHelp')}</p>
          <p className="text-xs text-slate-400">{data.worldview_notes.length}/300</p>
        </div>
      </div>
    </div>
  );
}
