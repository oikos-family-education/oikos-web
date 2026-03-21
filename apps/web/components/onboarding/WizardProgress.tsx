'use client';

import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  titles: string[];
}

export function WizardProgress({ currentStep, totalSteps, titles }: WizardProgressProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-slate-500">
          Step {currentStep} of {totalSteps}
        </p>
        <p className="text-sm font-bold text-primary">{titles[currentStep - 1]}</p>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
