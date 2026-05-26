'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from '../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Link as LinkIcon } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link } from '../../../../lib/navigation';
import { apiFetch } from '../../../../lib/apiFetch';
import { useAuth } from '../../../../providers/AuthProvider';
import { CommunityCard } from '../../../../components/community/CommunityCard';
import { CommunityFilters, type CommunityFilterValues } from '../../../../components/community/CommunityFilters';
import { Modal } from '../../../../components/dashboard/Modal';
import type { CommunityCard as CommunityCardData, CommunityDetail } from '../../../../components/community/types';

const EMPTY_FILTERS: CommunityFilterValues = {
  country: '',
  region: '',
  faith: '',
  ageMin: '',
  ageMax: '',
};

export default function CommunityIndexPage() {
  const t = useTranslations('Community');
  const router = useRouter();
  const { family } = useAuth();
  const [mine, setMine] = useState<CommunityDetail[]>([]);
  const [discover, setDiscover] = useState<CommunityCardData[]>([]);
  const [filters, setFilters] = useState<CommunityFilterValues>(EMPTY_FILTERS);
  const [filtersInitialised, setFiltersInitialised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Pre-select the family's country once auth has resolved. Without this the
  // index used to show every community globally, ignoring the spec's "scoped
  // to your country by default" requirement.
  useEffect(() => {
    if (filtersInitialised) return;
    if (family) {
      setFilters((prev) => ({ ...prev, country: family.location_country_code ?? '' }));
      setFiltersInitialised(true);
    }
  }, [family, filtersInitialised]);

  const loadDiscover = useCallback(async (f: CommunityFilterValues) => {
    setDiscoverLoading(true);
    const qs = new URLSearchParams();
    if (f.country) qs.set('country', f.country);
    if (f.region) qs.set('region', f.region);
    if (f.faith) qs.set('faith', f.faith);
    if (f.ageMin !== '') qs.set('age_min', f.ageMin);
    if (f.ageMax !== '') qs.set('age_max', f.ageMax);
    try {
      const res = await apiFetch(`/api/v1/communities?${qs.toString()}`);
      const data = res.ok ? await res.json() : { items: [] };
      setDiscover(data.items);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m = await apiFetch('/api/v1/communities/mine').then((r) => (r.ok ? r.json() : []));
        setMine(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!filtersInitialised) return;
    const id = setTimeout(() => loadDiscover(filters), 250);
    return () => clearTimeout(id);
  }, [filters, filtersInitialised, loadDiscover]);

  async function submitJoin() {
    if (!joinToken.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      let token = joinToken.trim();
      try {
        const url = new URL(token);
        const parts = url.pathname.split('/');
        token = decodeURIComponent(parts[parts.length - 1]);
      } catch {
        /* not a URL — treat as raw token */
      }
      const res = await apiFetch('/api/v1/communities/join/by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/community/${data.slug}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setJoinError(body.detail || t('errors.invalidToken'));
      }
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('indexTitle')}</h1>
          <p className="text-slate-500 mt-1">{t('indexSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <LinkIcon className="w-4 h-4" />
            {t('joinByLink')}
          </button>
          <Link href="/community/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              {t('createButton')}
            </Button>
          </Link>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('yourCommunitiesTitle')}</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white rounded-xl border border-slate-200 p-6">
            {t('yourCommunitiesEmpty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((c) => (
              <CommunityCard key={c.id} community={c} pending={c.viewer_status === 'pending'} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('discoverTitle')}</h2>

        <CommunityFilters value={filters} onChange={setFilters} />

        {discoverLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : discover.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white rounded-xl border border-slate-200 p-6">
            No communities match these filters yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discover.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </div>
        )}
      </section>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title={t('joinByLinkTitle')}>
        <div className="space-y-3">
          <input
            type="text"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            placeholder="https://… or paste token"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {joinError && <p className="text-xs text-red-500">{joinError}</p>}
          <div className="flex justify-end">
            <Button onClick={submitJoin} disabled={joining || !joinToken.trim()}>
              {joining ? '…' : t('joinByLinkAccept')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
