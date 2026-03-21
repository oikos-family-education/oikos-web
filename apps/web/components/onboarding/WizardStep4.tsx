'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FamilyFormData } from './FamilyWizard';
import { Eye, EyeOff, Globe } from 'lucide-react';

interface Props {
  data: FamilyFormData;
  onChange: (partial: Partial<FamilyFormData>) => void;
}

const VISIBILITY_OPTIONS = [
  { value: 'private', icon: EyeOff, label: 'Private', desc: 'Only you see your family. Invisible in community.' },
  { value: 'local', icon: Eye, label: 'Local', desc: 'Visible to families in your region who are also discoverable.' },
  { value: 'public', icon: Globe, label: 'Public', desc: 'Visible in the full family directory.' },
];

export function WizardStep4({ data, onChange }: Props) {
  const t = useTranslations('Onboarding');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t('step4Heading')}</h2>
        <p className="text-slate-500 mt-1">{t('step4Sub')}</p>
      </div>

      {/* Family Culture */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('cultureLabel')}</label>
        <textarea
          value={data.family_culture}
          onChange={(e) => onChange({ family_culture: e.target.value })}
          placeholder={t('culturePlaceholder')}
          maxLength={2000}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none text-sm leading-relaxed"
        />
        <div className="flex justify-between">
          <p className="text-xs text-slate-400">{t('cultureHelp')}</p>
          <p className="text-xs text-slate-400">{data.family_culture.length}/2,000</p>
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('visibilityLabel')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {VISIBILITY_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ visibility: opt.value })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  data.visibility === opt.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${data.visibility === opt.value ? 'text-primary' : 'text-slate-400'}`} />
                <span className="text-sm font-semibold text-slate-700 block">{opt.label}</span>
                <span className="text-xs text-slate-400 mt-1 block">{opt.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">{t('visibilityHelp')}</p>
      </div>
    </div>
  );
}
