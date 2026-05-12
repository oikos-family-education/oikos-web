'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link, useRouter } from '../../lib/navigation';
import {
  addDays,
  buildLessonWeekDays,
  formatLessonDate,
  groupLessonsByDate,
  startOfWeekISO,
  todayISO,
  type LessonStatus,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { LessonCard } from './LessonCard';

const STATUS_OPTIONS: LessonStatus[] = [
  'draft', 'scheduled', 'in_progress', 'completed', 'cancelled',
];

interface SubjectLite {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export function LessonsPage() {
  const t = useTranslations('Lessons');
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO());
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('from', weekStart);
      params.set('to', addDays(weekStart, 6));
      if (filterSubject) params.set('subject_id', filterSubject);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '200');
      const res = await fetch(`/api/v1/lessons?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('loadError'));
        setLoading(false);
        return;
      }
      const data: { items: LessonSummary[]; total: number } = await res.json();
      setLessons(data.items);
      setLoading(false);
    } catch {
      setError(t('loadError'));
      setLoading(false);
    }
  }, [weekStart, filterSubject, filterStatus, t]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/subjects?source=mine', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(
          (Array.isArray(data) ? data : data.items || []).map((s: SubjectLite) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            icon: s.icon,
          })),
        );
      }
    } catch {
      // ignore — subject filter is optional
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const weekDays = useMemo(() => {
    const grouped = groupLessonsByDate(lessons);
    return buildLessonWeekDays(weekStart, grouped);
  }, [lessons, weekStart]);

  function shiftWeek(days: number) {
    setWeekStart(addDays(weekStart, days));
  }

  function newLessonForDate(iso: string) {
    router.push(`/lessons/new?date=${iso}`);
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex p-3 rounded-2xl bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('pageTitle')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('pageSubtitle')}</p>
          </div>
        </div>
        <Link href="/lessons/new">
          <Button>
            <Plus className="w-4 h-4 mr-1" />
            {t('newLesson')}
          </Button>
        </Link>
      </div>

      {/* Filters + week pager */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 text-slate-600"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeekISO())}
            className="text-xs font-medium text-slate-700 px-3 py-1 rounded hover:bg-slate-100"
          >
            {formatLessonDate(weekStart)} – {formatLessonDate(addDays(weekStart, 6))}
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 text-slate-600"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700"
        >
          <option value="">{t('filterAll')} — {t('filterSubject')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700"
        >
          <option value="">{t('filterAll')} — {t('filterStatus')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_(.)/g, (_, c) => c.toUpperCase())}` as never)}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && weekDays.every((d) => d.lessons.length === 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-700">{t('emptyState')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('emptyStateHint')}</p>
          <div className="mt-4">
            <Link href="/lessons/new">
              <Button>{t('emptyStateAction')}</Button>
            </Link>
          </div>
        </div>
      )}
      {!loading && !error && weekDays.some((d) => d.lessons.length > 0) && (
        <div className="space-y-5">
          {weekDays.map((day) => {
            const isToday = day.date === todayISO();
            return (
              <div key={day.date}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-slate-700'}`}>
                    {formatLessonDate(day.date)}
                    {isToday ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide">Today</span> : null}
                  </h2>
                  <button
                    type="button"
                    onClick={() => newLessonForDate(day.date)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
                  >
                    <Plus className="w-3 h-3" />
                    {t('newLesson')}
                  </button>
                </div>
                {day.lessons.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">{t('noLessonsForDay')}</p>
                ) : (
                  <ul className="space-y-2">
                    {day.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <LessonCard lesson={lesson} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
