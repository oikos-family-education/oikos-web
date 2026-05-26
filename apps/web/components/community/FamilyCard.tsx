'use client';

import React from 'react';
import { Link } from '../../lib/navigation';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DiscoverFamilyCard } from './types';

interface Props {
  family: DiscoverFamilyCard;
  href?: string;
}

export function FamilyCard({ family, href }: Props) {
  const t = useTranslations('Discover');
  const link = href ?? `/discover/${family.family_name_slug}`;
  const showAges =
    family.children_count > 0 &&
    family.children_age_min !== null &&
    family.children_age_min !== undefined &&
    family.children_age_max !== null &&
    family.children_age_max !== undefined;

  return (
    <Link
      href={link}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-slate-800 truncate">{family.family_name}</h3>
        {family.faith_tradition && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize shrink-0">
            {family.faith_tradition}
          </span>
        )}
      </div>

      {(family.location_region || family.location_country) && (
        <p className="text-sm text-slate-500 mb-3">
          {[family.location_region, family.location_country].filter(Boolean).join(', ')}
        </p>
      )}

      {family.family_culture_excerpt && (
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-3">
          {family.family_culture_excerpt}
        </p>
      )}

      {family.education_methods.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {family.education_methods.slice(0, 3).map((m) => (
            <span key={m} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {m.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {family.home_languages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {family.home_languages.map((l) => (
            <span key={l} className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-600 uppercase">
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <Users className="w-4 h-4" />
        <span>
          {t('childrenSummary', { count: family.children_count })}
          {showAges && `, ${t('childrenAges', { min: family.children_age_min as number, max: family.children_age_max as number })}`}
        </span>
      </div>
    </Link>
  );
}
