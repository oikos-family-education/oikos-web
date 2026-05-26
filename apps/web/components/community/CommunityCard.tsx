'use client';

import React from 'react';
import { Link } from '../../lib/navigation';
import { Users, MapPin, Globe2, Lock, Baby } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CommunityCard as CommunityCardData } from './types';

interface Props {
  community: CommunityCardData;
  pending?: boolean;
}

export function CommunityCard({ community, pending = false }: Props) {
  const t = useTranslations('Community');
  return (
    <Link
      href={`/community/${community.slug}`}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-lg font-semibold text-slate-800 truncate">{community.name}</h3>
        {pending && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 shrink-0">
            {t('pendingBadge')}
          </span>
        )}
      </div>

      {community.tagline && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">{community.tagline}</p>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">
        <span className="inline-flex items-center gap-1">
          {community.region_scope === 'online' ? <Globe2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
          {t(`regionScope.${community.region_scope}`)}
          {community.country_code && community.region_scope !== 'online' && (
            <span>· {community.region ?? community.country_code}</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          {community.join_mode === 'invite_only' && <Lock className="w-3.5 h-3.5" />}
          {t(`joinMode.${community.join_mode}`)}
        </span>
        {(community.child_age_min !== null && community.child_age_min !== undefined) ||
        (community.child_age_max !== null && community.child_age_max !== undefined) ? (
          <span className="inline-flex items-center gap-1">
            <Baby className="w-3.5 h-3.5" />
            {community.child_age_min !== null && community.child_age_min !== undefined &&
             community.child_age_max !== null && community.child_age_max !== undefined
              ? t('ageRangeDisplay', { min: community.child_age_min, max: community.child_age_max })
              : community.child_age_max !== null && community.child_age_max !== undefined
              ? t('ageRangeOpenMin', { max: community.child_age_max })
              : t('ageRangeOpenMax', { min: community.child_age_min as number })}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-4 h-4" />
          {t('memberCount', { count: community.member_count })}
        </div>
        {community.principle_tags?.education_methods && community.principle_tags.education_methods.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {community.principle_tags.education_methods.slice(0, 2).map((m) => (
              <span key={m} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {m.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
