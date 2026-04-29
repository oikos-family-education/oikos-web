'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { GraduationCap } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';

interface ChildCurriculum {
  child_id: string;
  curriculum_id: string;
}

interface CurriculumListItem {
  id: string;
  name: string;
  description: string | null;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  child_curriculums: ChildCurriculum[];
}

interface CurriculumDetail extends CurriculumListItem {
  curriculum_subjects: { subject_id: string; is_active: boolean }[];
}

interface CurriculumWithCounts extends CurriculumListItem {
  subject_count: number;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semester: 'Semester',
  annual: 'Annual',
  custom: 'Custom',
};

export function ActiveCurriculums() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<CurriculumWithCounts[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/v1/curriculums', { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        return;
      }
      const list: CurriculumListItem[] = await res.json();
      const active = list.filter((c) => c.status === 'active');

      // Fetch subject counts in parallel (small list — okay).
      const enriched = await Promise.all(
        active.map(async (c) => {
          try {
            const r = await fetch(`/api/v1/curriculums/${c.id}`, { credentials: 'include' });
            if (!r.ok) return { ...c, subject_count: 0 };
            const detail: CurriculumDetail = await r.json();
            return {
              ...c,
              subject_count: (detail.curriculum_subjects || []).filter((s) => s.is_active).length,
            };
          } catch {
            return { ...c, subject_count: 0 };
          }
        })
      );
      setItems(enriched);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const headerActions = (
    <Link href="/curriculums" className="text-xs font-medium text-slate-500 hover:text-primary">
      {t('curriculumsViewAll')}
    </Link>
  );

  return (
    <WidgetCard
      title={t('curriculumsTitle')}
      actions={headerActions}
      testId="active-curriculums-widget"
    >
      {loading && <WidgetSkeleton rows={2} />}
      {!loading && error && <WidgetError onRetry={load} />}
      {!loading && !error && items && items.length === 0 && (
        <WidgetEmpty
          icon={<GraduationCap className="h-7 w-7" />}
          title={t('curriculumsEmpty')}
          hint={t('curriculumsEmptyHint')}
          cta={
            <Link
              href="/curriculums"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              {t('curriculumsViewAll')} →
            </Link>
          }
        />
      )}
      {!loading && !error && items && items.length > 0 && (
        <ul className="space-y-2" data-testid="curriculum-list">
          {items.map((c) => (
            <li key={c.id} data-testid="curriculum-row" data-curriculum-id={c.id}>
              <Link
                href={`/curriculums/${c.id}`}
                className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:border-primary/30 hover:bg-slate-50 transition-colors"
              >
                <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {PERIOD_LABEL[c.period_type] || c.period_type} ·{' '}
                    {t('curriculumsSubjects', { count: c.subject_count })} ·{' '}
                    {t('curriculumsChildren', { count: c.child_curriculums.length })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
