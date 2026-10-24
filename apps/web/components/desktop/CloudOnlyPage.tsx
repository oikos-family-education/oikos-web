'use client';

import React from 'react';
import { Cloud } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function CloudOnlyPage() {
  const t = useTranslations('Desktop');

  return (
    <div className="max-w-5xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <span className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
          <Cloud className="h-10 w-10 text-primary" />
        </span>
        <h1 className="text-2xl font-bold text-slate-800">{t('cloudOnlyPageTitle')}</h1>
        <p className="text-slate-500 mt-1">{t('cloudOnlyBody')}</p>
      </div>
    </div>
  );
}
