'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, CheckCircle2, Plus } from 'lucide-react';
import { Link } from '../../lib/navigation';
import { WidgetCard, WidgetEmpty, WidgetError, WidgetSkeleton } from './WidgetCard';
import {
  formatDuration,
  isLessonActionable,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { LessonStatusBadge } from '../lessons/LessonStatusBadge';

export function TodayLessons() {
  const t = useTranslations('Dashboard');
  const tL = useTranslations('Lessons');
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/v1/lessons/today', { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      const data: LessonSummary[] = await res.json();
      setLessons(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markComplete(lesson: LessonSummary) {
    setCompletingId(lesson.id);
    try {
      const res = await fetch(`/api/v1/lessons/${lesson.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          create_teaching_log: true,
        }),
      });
      if (res.ok) {
        load();
      }
    } finally {
      setCompletingId(null);
    }
  }

  const headerActions = (
    <>
      <Link
        href="/lessons"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        {t('todayLessonsViewAll')}
      </Link>
      <Link
        href="/lessons/new"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        {tL('newLesson')}
      </Link>
    </>
  );

  return (
    <WidgetCard
      title={t('todayLessonsTitle')}
      actions={headerActions}
      testId="today-lessons-widget"
    >
      {loading && <WidgetSkeleton rows={3} />}
      {!loading && error && <WidgetError onRetry={load} />}
      {!loading && !error && lessons && lessons.length === 0 && (
        <WidgetEmpty
          icon={<BookOpen className="h-8 w-8" />}
          title={t('todayLessonsEmpty')}
          hint={t('todayLessonsEmptyHint')}
          cta={
            <Link
              href="/lessons/new"
              className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover"
            >
              {t('todayLessonsPlan')}
            </Link>
          }
        />
      )}
      {!loading && !error && lessons && lessons.length > 0 && (
        <ul className="space-y-2">
          {lessons.map((lesson) => {
            const accent = lesson.subject.color || '#6366f1';
            return (
              <li key={lesson.id} className="flex items-stretch gap-3 rounded-lg border border-slate-200 bg-white hover:border-primary/40 transition-colors">
                <span
                  className="w-1 rounded-l-lg flex-shrink-0"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <Link href={`/lessons/${lesson.id}`} className="flex-1 min-w-0 px-2 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate flex-1">{lesson.title}</p>
                    <LessonStatusBadge status={lesson.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {lesson.subject.name}
                    {lesson.estimated_duration_minutes ? ` · ${formatDuration(lesson.estimated_duration_minutes)}` : ''}
                  </p>
                </Link>
                {isLessonActionable(lesson.status) && (
                  <button
                    type="button"
                    onClick={() => markComplete(lesson)}
                    disabled={completingId === lesson.id}
                    className="self-center mr-2 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-success/30 hover:bg-success/5 hover:text-success disabled:opacity-50"
                    aria-label={t('todayLessonsMarkComplete')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('todayLessonsMarkComplete')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
