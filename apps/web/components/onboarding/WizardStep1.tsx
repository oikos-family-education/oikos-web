'use client';

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import { ShieldBuilder } from './ShieldBuilder';
import type { FamilyFormData } from './FamilyWizard';
import { MapPin } from 'lucide-react';

interface Props {
  data: FamilyFormData;
  onChange: (partial: Partial<FamilyFormData>) => void;
}

export function WizardStep1({ data, onChange }: Props) {
  const t = useTranslations('Onboarding');

  // Auto-generate shield initials from family name
  useEffect(() => {
    if (data.family_name) {
      const words = data.family_name.trim().split(/\s+/);
      const initials = words
        .slice(0, 3)
        .map(w => w[0]?.toUpperCase() || '')
        .join('');
      onChange({
        shield_config: { ...data.shield_config, initials },
      });
    }
  }, [data.family_name]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t('step1Heading')}</h2>
        <p className="text-slate-500 mt-1">{t('step1Sub')}</p>
      </div>

      {/* Family Name */}
      <div className="space-y-2">
        <Input
          label={t('familyNameLabel')}
          placeholder={t('familyNamePlaceholder')}
          value={data.family_name}
          onChange={(e) => onChange({ family_name: e.target.value })}
          maxLength={80}
        />
        <p className="text-xs text-slate-400">{t('familyNameHelp')}</p>
      </div>

      {/* Shield Builder */}
      <ShieldBuilder
        config={data.shield_config}
        onChange={(shield_config) => onChange({ shield_config })}
      />

      {/* Location */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <label className="text-sm font-semibold text-slate-700">{t('locationLabel')}</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('cityLabel')}
            placeholder="Dublin"
            value={data.location_city}
            onChange={(e) => onChange({ location_city: e.target.value })}
          />
          <Input
            label={t('countryLabel')}
            placeholder="Ireland"
            value={data.location_country}
            onChange={(e) => onChange({ location_country: e.target.value })}
          />
        </div>
        <p className="text-xs text-slate-400">{t('locationHelp')}</p>
      </div>
    </div>
  );
}
