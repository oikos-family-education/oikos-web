'use client';

import React, { useState, useEffect } from 'react';
import { Library, Plus, Search, Loader2, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../lib/navigation';
import { ResourceCard, Resource, getTypeKey } from '../../../../components/resources/ResourceCard';

const RESOURCE_TYPES = [
  'book', 'article', 'video', 'course', 'podcast',
  'documentary', 'printable', 'website', 'curriculum', 'other',
];

interface Subject {
  id: string;
  name: string;
}

export default function ResourcesPage() {
  const t = useTranslations('Resources');
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [sortBy, setSortBy] = useState('title_asc');
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  useEffect(() => {
    fetchResources();
  }, [typeFilter, subjectFilter]);

  useEffect(() => {
    async function loadSubjects() {
      const res = await fetch('/api/v1/subjects?source=mine', { credentials: 'include' });
      if (res.ok) setSubjects(await res.json());
    }
    loadSubjects();
  }, []);

  async function fetchResources() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (subjectFilter) params.set('subject_id', subjectFilter);

    const res = await fetch(`/api/v1/resources?${params}`, { credentials: 'include' });
    if (res.ok) {
      setResources(await res.json());
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/v1/resources/${deleteTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setResources((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  // Client-side search and sort
  let filtered = resources;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.author && r.author.toLowerCase().includes(q))
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title_desc':
        return b.title.localeCompare(a.title);
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      default:
        return a.title.localeCompare(b.title);
    }
  });

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/resources/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('newResource')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">{t('filterAllTypes')}</option>
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(getTypeKey(type) as any)}
            </option>
          ))}
        </select>
        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">{t('filterAllSubjects')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="title_asc">{t('sortTitleAsc')}</option>
          <option value="title_desc">{t('sortTitleDesc')}</option>
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Library className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('emptyTitle')}</h3>
          <p className="text-slate-500 mb-6">{t('emptyDescription')}</p>
          <button
            onClick={() => router.push('/resources/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('emptyAction')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onEdit={() => router.push(`/resources/${resource.id}`)}
              onDelete={() => setDeleteTarget(resource)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {t('deleteConfirmTitle', { title: deleteTarget.title })}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {t('deleteConfirmMessage', { count: deleteTarget.subjects.length })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                {t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
