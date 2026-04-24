'use client';

import React, { useState } from 'react';
import { useRouter } from '../../lib/navigation';
import { useTranslations } from 'next-intl';
import { WizardProgress } from './WizardProgress';
import { WizardStep1 } from './WizardStep1';
import { WizardStep2 } from './WizardStep2';
import { WizardStep3 } from './WizardStep3';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@oikos/ui';
import { FamilyFormData, buildDefaultFormData } from '../family/familyFormTypes';

export type { FamilyFormData } from '../family/familyFormTypes';

const TOTAL_STEPS = 3;

export function FamilyWizard() {
  const router = useRouter();
  const t = useTranslations('Onboarding');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FamilyFormData>(buildDefaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateFormData = (partial: Partial<FamilyFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        faith_tradition: formData.faith_tradition || undefined,
        faith_denomination: formData.faith_denomination || undefined,
        faith_community_name: formData.faith_community_name || undefined,
        worldview_notes: formData.worldview_notes || undefined,
        education_purpose: formData.education_purpose || undefined,
        diet: formData.diet || undefined,
        screen_policy: formData.screen_policy || undefined,
        outdoor_orientation: formData.outdoor_orientation || undefined,
        family_culture: formData.family_culture || undefined,
        location_city: formData.location_city || undefined,
        location_region: formData.location_region || undefined,
        location_country: formData.location_country || undefined,
        location_country_code: formData.location_country_code || undefined,
      };

      const res = await fetch('/api/v1/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        const detail = data.detail;
        if (Array.isArray(detail)) {
          setError(detail.map((e: { msg?: string }) => e.msg ?? 'Validation error').join('; '));
        } else {
          setError(typeof detail === 'string' ? detail : 'Something went wrong.');
        }
        return;
      }

      router.push('/onboarding/children');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.family_name.trim().length >= 2;
    return true; // Steps 2-3 are optional
  };

  const stepTitles = [
    t('step1Title'),
    t('step2Title'),
    t('step3Title'),
  ];

  return (
    <div className="space-y-8">
      <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} titles={stepTitles} />

      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl p-8 sm:p-10 transition-all duration-300">
        {step === 1 && <WizardStep1 data={formData} onChange={updateFormData} />}
        {step === 2 && <WizardStep2 data={formData} onChange={updateFormData} />}
        {step === 3 && <WizardStep3 data={formData} onChange={updateFormData} />}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button onClick={prevStep} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t('back')}
            </button>
          ) : <div />}

          {step < TOTAL_STEPS ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="px-6 py-3 rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)]"
            >
              {t('next')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="px-8 py-3 rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> {t('createFamily')}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
