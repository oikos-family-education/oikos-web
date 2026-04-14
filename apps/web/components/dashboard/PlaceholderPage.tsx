'use client';

import React from 'react';
import { Link } from '../../lib/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  const t = useTranslations('Placeholder');

  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
      <p className="text-slate-500 mb-4">{description}</p>
      <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
        {t('comingSoon')}
      </span>
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
