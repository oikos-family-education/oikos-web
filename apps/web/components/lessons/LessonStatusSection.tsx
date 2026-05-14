'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LessonStatus, LessonSummary } from '../../lib/lessonUtils';
import { LessonCard } from './LessonCard';

export interface LessonStatusSectionProps {
  titleKey: string;
  statuses: LessonStatus[];
  order: 'asc' | 'desc';
  subjectId: string;
  pageSize: number;
}

export function LessonStatusSection({
  titleKey,
  statuses,
  order,
  subjectId,
  pageSize,
}: LessonStatusSectionProps) {
  const t = useTranslations('Lessons');
  const [items, setItems] = useState<LessonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const s of statuses) params.append('status', s);
      params.set('order', order);
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));
      if (subjectId) params.set('subject_id', subjectId);
      const res = await fetch(`/api/v1/lessons?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('loadError'));
        setLoading(false);
        return;
      }
      const data: { items: LessonSummary[]; total: number } = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setLoading(false);
    } catch {
      setError(t('loadError'));
      setLoading(false);
    }
  }, [statuses, order, subjectId, page, pageSize, t]);

  useEffect(() => { setPage(1); }, [subjectId]);
  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const count = total === 1
    ? t('sectionCountSingular', { count: total })
    : t('sectionCountPlural', { count: total });

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t(titleKey as never)}
          <span className="ml-2 text-xs font-normal text-slate-500">{count}</span>
        </h2>
        {totalPages > 1 && (
          <div className="inline-flex items-center gap-1 text-xs text-slate-600">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label={t('paginationPrevious')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium tabular-nums">
              {t('paginationPageOf', { page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label={t('paginationNext')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: Math.min(pageSize, 3) }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-slate-400 italic px-1">{t('sectionEmpty')}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((lesson) => (
            <li key={lesson.id}>
              <LessonCard lesson={lesson} showDate />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
