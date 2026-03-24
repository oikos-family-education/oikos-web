'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
  const [source, setSource] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    fetchSubjects();
  }, [source, category, search]);

  async function fetchSubjects() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (category) params.set('category', category);
    if (search) params.set('search', search);

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
            onChange={(e) => setSearch(e.target.value)}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
