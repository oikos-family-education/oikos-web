'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft, Users } from 'lucide-react';
import { Link } from '../../../../../lib/navigation';
import { apiFetch } from '../../../../../lib/apiFetch';
import { CommunityCard } from '../../../../../components/community/CommunityCard';
import type { FamilyDiscoverProfile } from '../../../../../components/community/types';

export default function FamilyProfilePage() {
  const t = useTranslations('Discover');
  const params = useParams();
  const slug = params.familySlug as string;
  const [data, setData] = useState<FamilyDiscoverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/families/${encodeURIComponent(slug)}/profile`);
        if (res.status === 404) setNotFound(true);
        else if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-3xl">
        <Link href="/discover" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          {t('noResults')}
        </div>
      </div>
    );
  }

  const showAges =
    data.children_count > 0 &&
    data.children_age_min !== null && data.children_age_min !== undefined &&
    data.children_age_max !== null && data.children_age_max !== undefined;

  return (
    <div className="max-w-4xl">
      <Link href="/discover" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-800">{data.family_name}</h1>
          {data.faith_tradition && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
              {data.faith_tradition}
              {data.faith_denomination ? ` · ${data.faith_denomination}` : ''}
            </span>
          )}
        </div>

        {(data.location_region || data.location_country) && (
          <p className="text-sm text-slate-500 mb-4">
            {[data.location_region, data.location_country].filter(Boolean).join(', ')}
          </p>
        )}

        <div className="inline-flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Users className="w-4 h-4" />
          <span>
            {t('childrenSummary', { count: data.children_count })}
            {showAges && `, ${t('childrenAges', { min: data.children_age_min as number, max: data.children_age_max as number })}`}
          </span>
        </div>

        {data.family_culture && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              {t('profileSection.about')}
            </h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{data.family_culture}</p>
          </section>
        )}

        {(data.education_methods.length > 0 || data.current_curriculum.length > 0 || data.education_purpose) && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              {t('profileSection.education')}
            </h2>
            {data.education_purpose && (
              <p className="text-sm text-slate-600 mb-2">
                <span className="font-semibold">Purpose:</span> {data.education_purpose.replace(/_/g, ' ')}
              </p>
            )}
            {data.education_methods.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.education_methods.map((m) => (
                  <span key={m} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {m.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            {data.current_curriculum.length > 0 && (
              <p className="text-sm text-slate-600">
                <span className="font-semibold">Curriculum:</span> {data.current_curriculum.join(', ')}
              </p>
            )}
          </section>
        )}

        {(data.diet || data.screen_policy || data.outdoor_orientation || data.home_languages.length > 0) && (
          <section className="mb-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              {t('profileSection.lifestyle')}
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {data.diet && <div><dt className="font-semibold text-slate-700">Diet</dt><dd className="text-slate-600">{data.diet}</dd></div>}
              {data.screen_policy && <div><dt className="font-semibold text-slate-700">Screen policy</dt><dd className="text-slate-600">{data.screen_policy.replace(/_/g, ' ')}</dd></div>}
              {data.outdoor_orientation && <div><dt className="font-semibold text-slate-700">Outdoor</dt><dd className="text-slate-600">{data.outdoor_orientation.replace(/_/g, ' ')}</dd></div>}
              {data.home_languages.length > 0 && <div><dt className="font-semibold text-slate-700">Languages</dt><dd className="text-slate-600 uppercase">{data.home_languages.join(', ')}</dd></div>}
            </dl>
          </section>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('communitiesYouShare')}</h2>
        {data.visible_communities.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
            {t('shareCommunityHint')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.visible_communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
