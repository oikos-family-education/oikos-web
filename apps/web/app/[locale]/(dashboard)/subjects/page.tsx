'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Plus, Search, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../lib/navigation';
import { SubjectCard } from '../../../../components/subjects/SubjectCard';
import { categoryKey } from '../../../../lib/categoryLabel';

interface Subject {
  id: string;
  family_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  category: string;
  color: string;
  icon: string | null;
  min_age_years: number | null;
  max_age_years: number | null;
  is_platform_subject: boolean;
  is_public: boolean;
  default_session_duration_minutes: number;
  default_weekly_frequency: number;
}

const CATEGORIES = [
  'core_academic', 'language', 'scripture_theology', 'arts',
  'physical', 'practical_life', 'logic_rhetoric', 'technology',
  'elective', 'co_op', 'other',
];

export default function SubjectsPage() {
  const t = useTranslations('Subjects');
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState<string>('mine');
  const [category, setCategory] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, category, debouncedSearch]);

  async function fetchSubjects() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (category) params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);

    const res = await fetch(`/api/v1/subjects?${params}`, { credentials: 'include' });
    if (res.ok) {
      setSubjects(await res.json());
    }
    setIsLoading(false);
  }

  async function handleFork(subjectId: string) {
    const res = await fetch(`/api/v1/subjects/${subjectId}/fork`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const forked = await res.json();
      router.push(`/subjects/${forked.id}/edit`);
    }
  }

  function openDelete(subject: Subject) {
    setDeleteTarget(subject);
    setDeleteError(null);
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteError(null);
    setIsDeleting(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/v1/subjects/${deleteTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 204) {
      setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      closeDelete();
      return;
    }
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      const detail: string = body.detail || '';
      const match = detail.match(/(\d+)/);
      const count = match ? Number(match[1]) : 0;
      setDeleteError(t('deleteConfirmInUse', { count }));
    } else {
      setDeleteError(t('deleteGenericError'));
    }
    setIsDeleting(false);
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/subjects/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('newSubject')}
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">{t('filterAll')}</option>
          <option value="mine">{t('filterMine')}</option>
          <option value="platform">{t('filterPlatform')}</option>
          <option value="community">{t('filterCommunity')}</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">{t('allCategories')}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{t(categoryKey(cat))}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('emptyTitle')}</h3>
          <p className="text-slate-500 mb-6">{t('emptyDescription')}</p>
          <button
            onClick={() => router.push('/subjects/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('emptyAction')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onFork={() => handleFork(subject.id)}
              onEdit={() => router.push(`/subjects/${subject.id}/edit`)}
              onDelete={() => openDelete(subject)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeDelete} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {t('deleteConfirmTitle')}
            </h3>
            <p className="text-sm text-slate-600 mb-2">
              <span className="font-medium text-slate-800">{deleteTarget.name}</span>
            </p>
            <p className="text-sm text-slate-500 mb-4">
              {deleteError || t('deleteConfirmMessage')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDelete}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting || Boolean(deleteError)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
