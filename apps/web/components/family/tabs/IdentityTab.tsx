'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { WizardStep1 } from '../../onboarding/WizardStep1';
import { ShieldBuilder, type ShieldConfig } from '../../onboarding/ShieldBuilder';
import { ShieldPreview } from '../../onboarding/ShieldPreview';
import { Button } from '@oikos/ui';
import { Loader2 } from 'lucide-react';
import { FamilyApiResponse, FamilyFormData } from '../familyFormTypes';
import { TabFormShell } from '../TabFormShell';

const defaultShield: ShieldConfig = {
  initials: '',
  shape: 'heater',
  primary_color: '#1B2A4A',
  secondary_color: '#C5A84B',
  accent_color: '#1C1C1C',
  symbol_color: '#FFFFFF',
  division: 'none',
  crest_animal: 'none',
  flourish: 'none',
  center_symbol: 'none',
  motto: '',
  font_style: 'serif',
};

interface Props {
  family: FamilyApiResponse;
  formData: FamilyFormData;
  onFamilyUpdated: (f: FamilyApiResponse) => void;
}

export function IdentityTab({ family, formData: initial, onFamilyUpdated }: Props) {
  const t = useTranslations('Family');
  const [formData, setFormData] = useState<FamilyFormData>(initial);
  const [dirty, setDirty] = useState(false);

  const [shieldEditing, setShieldEditing] = useState(false);
  const [shield, setShield] = useState<ShieldConfig>(() => ({
    ...defaultShield,
    ...((family.shield_config ?? {}) as Partial<ShieldConfig>),
  }));
  const [shieldSaving, setShieldSaving] = useState(false);
  const [shieldError, setShieldError] = useState('');

  React.useEffect(() => {
    setFormData(initial);
    setDirty(false);
  }, [initial]);

  const update = (partial: Partial<FamilyFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const saveShield = async () => {
    setShieldSaving(true);
    setShieldError('');
    try {
      const res = await fetch('/api/v1/families/me/shield', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shield),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setShieldError(typeof data.detail === 'string' ? data.detail : t('saveError'));
        return;
      }
      const updated: FamilyApiResponse = await res.json();
      onFamilyUpdated(updated);
      setShieldEditing(false);
    } catch {
      setShieldError(t('saveError'));
    } finally {
      setShieldSaving(false);
    }
  };

  const buildPayload = () => ({
    family_name: formData.family_name,
    location_city: formData.location_city || null,
    location_region: formData.location_region || null,
    location_country: formData.location_country || null,
    location_country_code: formData.location_country_code || null,
  });

  return (
    <div className="space-y-6">
      <TabFormShell
        formData={formData}
        dirty={dirty}
        buildPayload={buildPayload}
        onSaved={(updated) => {
          onFamilyUpdated(updated);
          setDirty(false);
        }}
        onCancel={() => {
          setFormData(initial);
          setDirty(false);
        }}
      >
        <WizardStep1 data={formData} onChange={update} />
      </TabFormShell>

      <div className="bg-white rounded-xl border border-slate-200 p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 flex-shrink-0">
              <ShieldPreview config={shield} familyName={family.family_name} showMotto={false} width={96} height={96} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{t('coatOfArmsTitle')}</h2>
              <p className="text-slate-500 text-sm mt-1">{family.family_name}</p>
            </div>
          </div>
          {!shieldEditing && (
            <Button type="button" onClick={() => setShieldEditing(true)} className="px-4 shrink-0">
              {t('coatOfArmsEdit')}
            </Button>
          )}
        </div>

        {shieldEditing && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <ShieldBuilder
              config={shield}
              familyName={family.family_name}
              onChange={setShield}
            />
            {shieldError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {shieldError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShield({
                    ...defaultShield,
                    ...((family.shield_config ?? {}) as Partial<ShieldConfig>),
                  });
                  setShieldEditing(false);
                  setShieldError('');
                }}
                disabled={shieldSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <Button type="button" onClick={saveShield} disabled={shieldSaving} className="px-6">
                {shieldSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('saving')}</>
                ) : (
                  t('coatOfArmsDone')
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
