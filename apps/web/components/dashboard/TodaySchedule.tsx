'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import {
  BookOpen, CalendarDays, Calendar as CalendarIcon,
  CheckCircle2, LayoutGrid, Plus, Users,
} from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';
import {
  formatDuration,
  isLessonActionable,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { LessonStatusBadge } from '../lessons/LessonStatusBadge';

interface RoutineEntry {
  id: string;
  subject_id: string | null;
  subject_name: string | null;
  is_free_time: boolean;
  child_ids: string[];
  child_names: string[];
  day_of_week: number;
  start_minute: number;
  duration_minutes: number;
  priority: string;
  color: string | null;
  notes: string | null;
}

interface CalendarEvent {
  id: string;
  family_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  all_day: boolean;
  start_at: string;
  end_at: string;
  child_ids: string[];
  color: string | null;
  location: string | null;
}

type ScheduleItem =
  | {
      kind: 'routine';
      data: RoutineEntry;
      sortKey: number;
      startMinute: number;
      endMinute: number;
    }
  | {
      kind: 'event';
      data: CalendarEvent;
      sortKey: number;
      startMinute: number;
      endMinute: number;
    };

function formatMinuteOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ChildBadges({ names }: { names: string[] }) {
  if (!names.length) return null;
  const visible = names.slice(0, 3);
  const extra = names.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Users className="h-3 w-3 text-slate-400" aria-hidden />
      <div className="flex -space-x-1">
        {visible.map((name, i) => (
          <span
            key={i}
            title={name}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary border border-white"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600 border border-white">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

export function TodaySchedule() {
  const t = useTranslations('Dashboard');
  const tL = useTranslations('Lessons');
  const [routine, setRoutine] = useState<RoutineEntry[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    const res = await fetch('/api/v1/lessons/today', { credentials: 'include' });
    if (!res.ok) throw new Error('lessons');
    return (await res.json()) as LessonSummary[];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const today = todayISO();
      const [r, e, l] = await Promise.all([
        fetch('/api/v1/week-planner/today', { credentials: 'include' }),
        fetch(`/api/v1/calendar/events?from=${today}&to=${today}`, { credentials: 'include' }),
        loadLessons().catch(() => [] as LessonSummary[]),
      ]);
      if (!r.ok || !e.ok) {
        setError(true);
        return;
      }
      const rData: RoutineEntry[] = await r.json();
      const eData = await e.json();
      setRoutine(rData);
      setEvents(eData?.events || []);
      setLessons(l);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadLessons]);

  useEffect(() => {
    load();
  }, [load]);

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
        const next = await loadLessons().catch(() => null);
        if (next) setLessons(next);
      }
    } finally {
      setCompletingId(null);
    }
  }

  const { allDayEvents, timedItems } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: ScheduleItem[] = [];
    if (routine) {
      for (const r of routine) {
        timed.push({
          kind: 'routine',
          data: r,
          sortKey: r.start_minute,
          startMinute: r.start_minute,
          endMinute: r.start_minute + r.duration_minutes,
        });
      }
    }
    if (events) {
      for (const ev of events) {
        if (ev.all_day) {
          allDay.push(ev);
          continue;
        }
        const start = new Date(ev.start_at);
        const end = new Date(ev.end_at);
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        timed.push({
          kind: 'event',
          data: ev,
          sortKey: startMin,
          startMinute: startMin,
          endMinute: endMin > startMin ? endMin : startMin,
        });
      }
    }
    timed.sort((a, b) => a.sortKey - b.sortKey);
    return { allDayEvents: allDay, timedItems: timed };
  }, [routine, events]);

  // Bucket today's lessons by subject id so each routine can pick up the
  // lessons that share its subject. Lessons are consumed by the first
  // matching routine in the timeline so they appear only once.
  const { lessonsForRoutine, unscheduledLessons } = useMemo(() => {
    const byRoutineId = new Map<string, LessonSummary[]>();
    const unmatched: LessonSummary[] = [];
    if (!lessons || lessons.length === 0) {
      return { lessonsForRoutine: byRoutineId, unscheduledLessons: unmatched };
    }
    const bySubject = new Map<string, LessonSummary[]>();
    for (const l of lessons) {
      const sid = l.subject?.id;
      if (!sid) continue;
      const list = bySubject.get(sid) || [];
      list.push(l);
      bySubject.set(sid, list);
    }
    // First routine occurrence wins for each subject.
    const consumed = new Set<string>();
    for (const item of timedItems) {
      if (item.kind !== 'routine') continue;
      const sid = item.data.subject_id;
      if (!sid) continue;
      const matching = bySubject.get(sid);
      if (!matching || matching.length === 0) continue;
      if (consumed.has(sid)) continue;
      byRoutineId.set(item.data.id, matching);
      consumed.add(sid);
    }
    for (const l of lessons) {
      const sid = l.subject?.id;
      if (!sid || !consumed.has(sid)) unmatched.push(l);
    }
    return { lessonsForRoutine: byRoutineId, unscheduledLessons: unmatched };
  }, [lessons, timedItems]);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const { currentIdx, nextIdx } = useMemo(() => {
    let cur = -1;
    let nxt = -1;
    for (let i = 0; i < timedItems.length; i++) {
      const it = timedItems[i];
      if (cur === -1 && nowMinutes >= it.startMinute && nowMinutes < it.endMinute) {
        cur = i;
      }
      if (nxt === -1 && it.startMinute > nowMinutes) {
        nxt = i;
      }
    }
    return { currentIdx: cur, nextIdx: nxt };
  }, [timedItems, nowMinutes]);

  const hasItems =
    allDayEvents.length > 0
    || timedItems.length > 0
    || (lessons !== null && lessons.length > 0);

  const headerActions = (
    <>
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        {t('linkCalendar')}
      </Link>
      <Link
        href="/planner"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        {t('linkPlanner')}
      </Link>
      <Link
        href="/lessons"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        <BookOpen className="h-3.5 w-3.5" />
        {t('linkLessons')}
      </Link>
    </>
  );

  function renderLessonRow(lesson: LessonSummary, accentOverride?: string) {
    const accent = accentOverride || lesson.subject.color || '#6366f1';
    return (
      <li
        key={`lesson-${lesson.id}`}
        className="flex items-stretch gap-3 rounded-lg border border-slate-200 bg-white hover:border-primary/40 transition-colors"
      >
        <span
          className="w-1 rounded-l-lg flex-shrink-0"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 min-w-0 px-2 py-2 flex items-center gap-2"
        >
          <BookOpen className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate flex-1">{lesson.title}</p>
              <LessonStatusBadge status={lesson.status} />
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {lesson.subject.name}
              {lesson.estimated_duration_minutes ? ` · ${formatDuration(lesson.estimated_duration_minutes)}` : ''}
            </p>
          </div>
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
  }

  return (
    <WidgetCard title={t('todayTitle')} actions={headerActions}>
      {loading && <WidgetSkeleton rows={4} />}
      {!loading && error && <WidgetError onRetry={load} />}
      {!loading && !error && !hasItems && (
        <WidgetEmpty
          icon={<CalendarDays className="h-8 w-8" />}
          title={t('todayEmpty')}
          hint={t('todayEmptyHint')}
        />
      )}
      {!loading && !error && hasItems && (
        <div className="space-y-4">
          {allDayEvents.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {allDayEvents.map((ev) => {
                const accent = ev.color || '#22c55e';
                return (
                  <li key={`allday-${ev.id}`}>
                    <Link
                      href={`/calendar?event=${ev.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-primary/30 hover:bg-white transition-colors"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                      <span className="text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">
                        All day
                      </span>
                      <span className="truncate max-w-[14rem]">{ev.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {timedItems.length > 0 && (
            <ol className="relative space-y-1.5">
              {timedItems.map((item, idx) => {
                const prevHour =
                  idx > 0 ? Math.floor(timedItems[idx - 1].startMinute / 60) : -1;
                const currHour = Math.floor(item.startMinute / 60);
                const newHour = currHour !== prevHour;
                const isCurrent = idx === currentIdx;
                const isNext = idx === nextIdx;

                const cardClass = isCurrent
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                  : isNext
                    ? 'border-primary/40 bg-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm';

                const StatusBadge = isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
                    {t('todayNow')}
                  </span>
                ) : isNext ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary whitespace-nowrap">
                    {t('todayUpNext')}
                  </span>
                ) : null;

                if (item.kind === 'routine') {
                  const r = item.data;
                  const title = r.is_free_time ? 'Free time' : r.subject_name || 'Untitled';
                  const accent = r.color || (r.is_free_time ? '#94a3b8' : '#6366f1');
                  const dim = r.is_free_time && !isCurrent && !isNext ? 'opacity-70' : '';
                  const matchingLessons = lessonsForRoutine.get(r.id) || [];
                  return (
                    <li key={`routine-${r.id}`}>
                      {newHour && idx > 0 && <div className="h-2" aria-hidden />}
                      <Link
                        href="/planner"
                        className={`flex items-stretch gap-3 rounded-lg border transition-all ${cardClass} ${dim}`}
                      >
                        <span
                          className="w-1 rounded-l-lg flex-shrink-0"
                          style={{ backgroundColor: accent }}
                          aria-hidden
                        />
                        <div className="flex items-center gap-3 px-2 py-2.5 flex-1 min-w-0">
                          <div className="w-16 flex-shrink-0 text-right">
                            <p className="text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap leading-tight">
                              {formatMinuteOfDay(r.start_minute)}
                            </p>
                            <p className="text-[10px] text-slate-400 whitespace-nowrap leading-tight">
                              {r.duration_minutes} min
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
                              {StatusBadge}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {t('sourceWeekPlanner')}
                            </p>
                          </div>
                          <ChildBadges names={r.child_names} />
                        </div>
                      </Link>
                      {matchingLessons.length > 0 && (
                        <ul className="mt-1.5 ml-[5.25rem] space-y-1.5">
                          {matchingLessons.map((lesson) => renderLessonRow(lesson, accent))}
                        </ul>
                      )}
                    </li>
                  );
                }
                const ev = item.data;
                const accent = ev.color || '#22c55e';
                return (
                  <li key={`event-${ev.id}`}>
                    {newHour && idx > 0 && <div className="h-2" aria-hidden />}
                    <Link
                      href={`/calendar?event=${ev.id}`}
                      className={`flex items-stretch gap-3 rounded-lg border transition-all ${cardClass}`}
                    >
                      <span
                        className="w-1 rounded-l-lg flex-shrink-0"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                      <div className="flex items-center gap-3 px-2 py-2.5 flex-1 min-w-0">
                        <div className="w-16 flex-shrink-0 text-right">
                          <p className="text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap leading-tight">
                            {formatDateTime(ev.start_at)}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                            {StatusBadge}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {t('sourceCalendar')}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {unscheduledLessons.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                  {t('todayLessonsOutsideSchedule')}
                </p>
                <Link
                  href="/lessons/new"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                  {tL('newLesson')}
                </Link>
              </div>
              <ul className="space-y-1.5">
                {unscheduledLessons.map((lesson) => renderLessonRow(lesson))}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
