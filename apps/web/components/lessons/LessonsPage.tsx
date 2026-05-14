'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Printer,
} from 'lucide-react';
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
import { useAuth } from '../../providers/AuthProvider';
import { LessonCard } from './LessonCard';
import { LessonStatusSection } from './LessonStatusSection';
import { PrintAllLessons } from './PrintAllLessons';

const STATUS_OPTIONS: LessonStatus[] = [
  'draft', 'scheduled', 'in_progress', 'completed', 'cancelled',
];

const LIST_PAGE_SIZE = 20;

type ViewMode = 'week' | 'list';

interface SubjectLite {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export function LessonsPage() {
  const t = useTranslations('Lessons');
  const router = useRouter();
  const { family } = useAuth();
  const [weekLessons, setWeekLessons] = useState<LessonSummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO());
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bulk-print state: when non-null, render the hidden print sheet and fire
  // window.print() after React commits. afterprint clears it back to null.
  const [printAllLessons, setPrintAllLessons] = useState<LessonSummary[] | null>(null);
  const [printAllLoading, setPrintAllLoading] = useState(false);

  // Week view fetches one week's worth of lessons; List view delegates to
  // per-section components that fetch independently with their own pagination.
  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('from', weekStart);
      params.set('to', addDays(weekStart, 6));
      params.set('limit', '200');
      if (filterSubject) params.set('subject_id', filterSubject);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/v1/lessons?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('loadError'));
        setLoading(false);
        return;
      }
      const data: { items: LessonSummary[]; total: number } = await res.json();
      setWeekLessons(data.items);
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

  useEffect(() => {
    if (viewMode === 'week') loadWeek();
  }, [viewMode, loadWeek]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const weekDays = useMemo(() => {
    const grouped = groupLessonsByDate(weekLessons);
    return buildLessonWeekDays(weekStart, grouped);
  }, [weekLessons, weekStart]);

  function shiftWeek(days: number) {
    setWeekStart(addDays(weekStart, days));
  }

  function newLessonForDate(iso: string) {
    router.push(`/lessons/new?date=${iso}`);
  }

  // Print-all flow: fetch every active lesson (draft + scheduled +
  // in_progress) with content_html, render them in a hidden print sheet,
  // then trigger window.print() once React has committed the DOM.
  const handlePrintAll = useCallback(async () => {
    if (printAllLoading) return;
    setPrintAllLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'draft');
      params.append('status', 'scheduled');
      params.append('status', 'in_progress');
      params.set('include_content', 'true');
      params.set('order', 'asc');
      params.set('limit', '200');
      if (filterSubject) params.set('subject_id', filterSubject);
      const res = await fetch(`/api/v1/lessons?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('loadError'));
        setPrintAllLoading(false);
        return;
      }
      const data: { items: LessonSummary[]; total: number } = await res.json();
      setPrintAllLessons(data.items);
      setPrintAllLoading(false);
    } catch {
      setError(t('loadError'));
      setPrintAllLoading(false);
    }
  }, [printAllLoading, filterSubject, t]);

  // Once the print sheet has mounted, add the body class and call print.
  // afterprint cleans both up so the screen view returns to normal.
  useEffect(() => {
    if (!printAllLessons) return;
    document.body.classList.add('printing-all-lessons');
    const cleanup = () => {
      document.body.classList.remove('printing-all-lessons');
      setPrintAllLessons(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Defer to next frame so the DOM is fully painted.
    const id = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('printing-all-lessons');
    };
  }, [printAllLessons]);

  const isEmptyWeek = weekDays.every((d) => d.lessons.length === 0);
  const showWeekEmpty = viewMode === 'week' && !loading && !error && isEmptyWeek;

  return (
    <>
    {/* Hidden print sheet for bulk-print flow. Rendered as a sibling of
        max-w-6xl so it's a direct child of <main> — the print stylesheet
        uses `main > *:not(.print-all-lessons)` to hide everything else,
        which only works if .print-all-lessons sits directly under main. */}
    {printAllLessons && <PrintAllLessons lessons={printAllLessons} family={family} />}
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
        <div className="flex items-center gap-2">
          {viewMode === 'week' && (
            <button
              type="button"
              onClick={handlePrintAll}
              disabled={printAllLoading}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              title={t('printAllHint')}
            >
              <Printer className="w-4 h-4" />
              {printAllLoading ? t('printAllLoading') : t('printAll')}
            </button>
          )}
          <Link href="/lessons/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              {t('newLesson')}
            </Button>
          </Link>
        </div>
      </div>

      {/* View toggle */}
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 mb-4"
        role="tablist"
        aria-label={t('pageTitle')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'week'}
          onClick={() => setViewMode('week')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            viewMode === 'week'
              ? 'bg-primary text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {t('weekView')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'list'}
          onClick={() => setViewMode('list')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-primary text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          {t('listView')}
        </button>
      </div>

      {/* Filters + (week-only) week pager */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {viewMode === 'week' && (
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
        )}

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

        {viewMode === 'week' && (
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
        )}
      </div>

      {/* Week view body */}
      {viewMode === 'week' && loading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {viewMode === 'week' && !loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {showWeekEmpty && (
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
      {viewMode === 'week' && !loading && !error && !isEmptyWeek && (
        <div className="space-y-5">
          {weekDays.map((day) => {
            const today = todayISO();
            const isToday = day.date === today;
            const isPast = day.date < today;
            return (
              <div key={day.date}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-slate-700'}`}>
                    {formatLessonDate(day.date)}
                    {isToday ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide">Today</span> : null}
                  </h2>
                  {!isPast && (
                    <button
                      type="button"
                      onClick={() => newLessonForDate(day.date)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
                    >
                      <Plus className="w-3 h-3" />
                      {t('newLesson')}
                    </button>
                  )}
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

      {/* List view body — each section paginates independently */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          <LessonStatusSection
            titleKey="statusDraft"
            statuses={['draft']}
            order="asc"
            subjectId={filterSubject}
            pageSize={LIST_PAGE_SIZE}
          />
          <LessonStatusSection
            titleKey="statusScheduled"
            statuses={['scheduled']}
            order="asc"
            subjectId={filterSubject}
            pageSize={LIST_PAGE_SIZE}
          />
          <LessonStatusSection
            titleKey="statusInProgress"
            statuses={['in_progress']}
            order="asc"
            subjectId={filterSubject}
            pageSize={LIST_PAGE_SIZE}
          />
          <LessonStatusSection
            titleKey="sectionPast"
            statuses={['completed', 'cancelled']}
            order="desc"
            subjectId={filterSubject}
            pageSize={LIST_PAGE_SIZE}
          />
        </div>
      )}
    </div>
    </>
  );
}
