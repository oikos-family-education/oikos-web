'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '../../../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@oikos/ui';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { Link } from '../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../lib/apiFetch';
import { CommunityTabs } from '../../../../../../components/community/CommunityTabs';
import { Modal } from '../../../../../../components/dashboard/Modal';
import type { CommunityDetail } from '../../../../../../components/community/types';

export default function CommunitySettingsPage() {
  const t = useTranslations('Community.settings');
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [c, setC] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [principles, setPrinciples] = useState('');
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data: CommunityDetail = await res.json();
        setC(data);
        setName(data.name);
        setTagline(data.tagline ?? '');
        setDescription(data.description);
        setPrinciples(data.principles_text);
        setAgeMin(data.child_age_min == null ? '' : String(data.child_age_min));
        setAgeMax(data.child_age_max == null ? '' : String(data.child_age_max));
      }
      setLoading(false);
    })();
  }, [slug]);

  async function save() {
    if (!c) return;
    setError(null);
    const lo = ageMin === '' ? null : Number(ageMin);
    const hi = ageMax === '' ? null : Number(ageMax);
    if (lo !== null && hi !== null && lo > hi) {
      setError('Minimum age must be less than or equal to maximum age.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        description,
        principles_text: principles,
        child_age_min: lo,
        child_age_max: hi,
      };
      if (tagline !== (c.tagline ?? '')) body.tagline = tagline;
      if (c.viewer_role === 'admin' && name !== c.name) body.name = name;
      const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: CommunityDetail = await res.json();
        setC(updated);
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b.detail || 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    router.push('/community');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!c || (c.viewer_role !== 'admin' && c.viewer_role !== 'co_admin')) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Admin only.
      </p>
    );
  }

  const isAdmin = c.viewer_role === 'admin';

  return (
    <div className="max-w-3xl">
      <Link href={`/community/${slug}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {c.name}
      </Link>

      <CommunityTabs slug={slug} canSettings={true} />

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 mb-6">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          disabled={!isAdmin}
        />
        <Input
          label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={140}
        />
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Principles</label>
          <textarea
            value={principles}
            onChange={(e) => setPrinciples(e.target.value)}
            rows={6}
            maxLength={4000}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Children&apos;s age range (optional)</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={0}
              max={25}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              placeholder="Min"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="number"
              min={0}
              max={25}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              placeholder="Max"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-red-800 mb-2">{t('deleteCommunity')}</h3>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 text-sm"
          >
            <Trash2 className="w-4 h-4" /> {t('deleteCommunity')}
          </button>
        </div>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('deleteConfirmTitle')}>
        <p className="text-sm text-slate-600 mb-4">{t('deleteConfirmBody')}</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDelete(false)} className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5">
            Cancel
          </button>
          <button onClick={destroy} className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700">
            {t('deleteConfirm')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
