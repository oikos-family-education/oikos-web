'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../../lib/apiFetch';
import { DiscoverFilters, type DiscoverFilterValues } from '../../../../components/community/DiscoverFilters';
import { FamilyCard } from '../../../../components/community/FamilyCard';
import type { DiscoverFamilyCard } from '../../../../components/community/types';

const EMPTY: DiscoverFilterValues = {
  country: '',
  region: '',
  faith: '',
  denomination: '',
  methods: [],
  languages: [],
};

export default function DiscoverPage() {
  const t = useTranslations('Discover');
  const [filters, setFilters] = useState<DiscoverFilterValues>(EMPTY);
  const [items, setItems] = useState<DiscoverFamilyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (f: DiscoverFilterValues) => {
    if (!f.country) {
      setItems([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({ country: f.country });
    if (f.region) qs.set('region', f.region);
    if (f.faith) qs.set('faith', f.faith);
    if (f.denomination) qs.set('denomination', f.denomination);
    if (f.methods.length) qs.set('methods', f.methods.join(','));
    if (f.languages.length) qs.set('languages', f.languages.join(','));

    try {
      const res = await apiFetch(`/api/v1/families/discover?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(filters), 200);
    return () => clearTimeout(id);
  }, [filters, load]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <DiscoverFilters value={filters} onChange={setFilters} />

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {!loading && !filters.country && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          {t('pickCountryPrompt')}
        </div>
      )}

      {!loading && filters.country && items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          {t('noResults')}
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="text-sm text-slate-500 mb-4">
            {total} {total === 1 ? 'family' : 'families'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((f) => (
              <FamilyCard key={f.id} family={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
