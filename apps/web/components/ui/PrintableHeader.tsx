'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface PrintableHeaderProps {
  shieldConfig: ShieldConfig | null;
  familyName: string;
}

/**
 * Standard header for every A4 / printable surface (certificate, progress report,
 * printed lesson packs, planner exports). Family coat of arms on the LEFT, Oikos
 * brand mark on the RIGHT. Do not invent ad-hoc print headers — extend this.
 */
export function PrintableHeader({ shieldConfig, familyName }: PrintableHeaderProps) {
  const hasShield = !!shieldConfig;

  return (
    <div className="flex items-center justify-between w-full">
      {/* Family coat of arms (left) */}
      <div className="flex flex-col items-center">
        {hasShield ? (
          <ShieldPreview
            config={shieldConfig!}
            familyName={familyName}
            showFamilyName
            familyNameFontSize={8}
            width={110}
            height={130}
          />
        ) : (
          <div
            className="border border-slate-200 rounded-md flex items-center justify-center text-slate-300 text-xs"
            style={{ width: 110, height: 130 }}
          >
            no shield
          </div>
        )}
      </div>

      {/* Oikos brand mark (right) */}
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 shadow-lg shadow-primary/20"
          style={{ width: 60, height: 60 }}
        >
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <span
          className="text-xs mt-2 font-semibold text-slate-800"
          style={{ letterSpacing: '0.15em' }}
        >
          OIKOS
        </span>
      </div>
    </div>
  );
}
