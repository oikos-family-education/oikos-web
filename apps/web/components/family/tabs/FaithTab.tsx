'use client';

import React, { useEffect, useState } from 'react';
import { WizardStep2 } from '../../onboarding/WizardStep2';
import { FamilyApiResponse, FamilyFormData } from '../familyFormTypes';
import { TabFormShell } from '../TabFormShell';

interface Props {
  family: FamilyApiResponse;
  formData: FamilyFormData;
  onFamilyUpdated: (f: FamilyApiResponse) => void;
}

export function FaithTab({ formData: initial, onFamilyUpdated }: Props) {
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
    faith_tradition: formData.faith_tradition || null,
    faith_denomination: formData.faith_denomination || null,
    faith_community_name: formData.faith_community_name || null,
    worldview_notes: formData.worldview_notes || null,
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
      <WizardStep2 data={formData} onChange={update} />
    </TabFormShell>
  );
}
