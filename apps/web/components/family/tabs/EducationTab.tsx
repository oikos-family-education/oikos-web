'use client';

import React, { useEffect, useState } from 'react';
import { WizardStep3 } from '../../onboarding/WizardStep3';
import { FamilyApiResponse, FamilyFormData } from '../familyFormTypes';
import { TabFormShell } from '../TabFormShell';

interface Props {
  family: FamilyApiResponse;
  formData: FamilyFormData;
  onFamilyUpdated: (f: FamilyApiResponse) => void;
}

export function EducationTab({ formData: initial, onFamilyUpdated }: Props) {
  const [formData, setFormData] = useState<FamilyFormData>(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFormData(initial);
    setDirty(false);
  }, [initial]);

  const update = (partial: Partial<FamilyFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const buildPayload = () => ({
    education_purpose: formData.education_purpose || null,
    education_methods: formData.education_methods,
    current_curriculum: formData.current_curriculum,
    diet: formData.diet || null,
    screen_policy: formData.screen_policy || null,
    outdoor_orientation: formData.outdoor_orientation || null,
    home_languages: formData.home_languages,
    family_culture: formData.family_culture || null,
  });

  return (
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
      <WizardStep3 data={formData} onChange={update} hideVisibility />
    </TabFormShell>
  );
}
