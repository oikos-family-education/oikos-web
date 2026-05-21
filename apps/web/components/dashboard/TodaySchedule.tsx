'use client';

import { apiFetch } from '../../lib/apiFetch';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import {
  BookOpen, CalendarDays, Calendar as CalendarIcon,
  CheckCheck, CheckCircle2, Flame, Info, LayoutGrid,
  Loader2, NotebookPen, Plus, Users,
} from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';
import {
  formatDuration,
  isLessonActionable,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { LessonStatusBadge } from '../lessons/LessonStatusBadge';
import { parseCustomNotes } from '../planner/types';
import { useDayLogs, type MarkAllPair } from '../../hooks/useDayLogs';
import { useProgressSummary, type ProgressSummary } from '../../hooks/useProgressSummary';
import { ChildLogBadges } from '../progress/ChildLogBadges';

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

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getThisWeekDates(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Monday = first day. JS getDay() returns 0=Sun..6=Sat — convert to Mon=0..Sun=6
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function routineCanBeTicked(r: RoutineEntry): boolean {
  return !r.is_free_time && !!r.subject_id && r.child_ids.length > 0;
}

function summaryRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(today) };
}

// ─────────────────────────────────────────────────────────────────────────
// Streak banner — thin clickable strip at the top of the widget body.
// Replaces the old separate Progress widget; brings back the M–S mini bars.
// ─────────────────────────────────────────────────────────────────────────

function StreakBanner({
  summary,
  isLoading,
}: {
  summary: ProgressSummary | null;
  isLoading: boolean;
}) {
  const t = useTranslations('Dashboard');
  const week = useMemo(() => getThisWeekDates(), []);
  const todayKey = isoDate(new Date());

  const heatmapByDate = useMemo(() => {
    const m = new Map<string, number>();
    if (summary) {
      for (const cell of summary.heatmap) m.set(cell.date, cell.count);
    }
    return m;
  }, [summary]);

  if (isLoading && !summary) {
    return (
      <div className="h-24 rounded-xl bg-slate-100 animate-pulse" aria-hidden />
    );
  }

  const streak = summary?.overall_streak;
  const weeks = streak?.current_weeks ?? 0;
  const hasStreak = weeks > 0;

  return (
    <Link
      href="/progress"
      className={`block rounded-xl border p-4 transition-colors ${
        hasStreak
          ? 'border-amber-200 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
      }`}
      aria-label={t('streakBannerAria')}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex-shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-2xl ${
            hasStreak ? 'bg-orange-100' : 'bg-slate-100'
          }`}
          aria-hidden
        >
          <Flame
            className={`h-7 w-7 ${hasStreak ? 'text-orange-500' : 'text-slate-400'}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {hasStreak ? (
            <>
              <p className="text-base font-bold text-slate-800 leading-tight">
                {t('progressStreakWeeks', { count: weeks })}
              </p>
              {streak?.weekly_target ? (
                <p className="text-xs text-slate-600 mt-0.5">
                  {streak.this_week_count} / {streak.weekly_target} this week
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-base font-bold text-slate-800 leading-tight">
                {t('streakBannerEmptyTitle')}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {t('progressStreakStart')}
              </p>
            </>
          )}
        </div>

        <div className="flex items-end gap-1.5 flex-shrink-0">
          {week.map((d, i) => {
            const key = isoDate(d);
            const count = heatmapByDate.get(key) ?? 0;
            const isToday = key === todayKey;
            const inFuture = d.getTime() > new Date(todayKey).getTime();
            let bg = 'bg-slate-200';
            let aria = `${DAY_LABELS[i]}: not logged`;
            if (count > 0) {
              bg = 'bg-primary';
              aria = `${DAY_LABELS[i]}: ${count} ${count === 1 ? 'session' : 'sessions'}`;
            } else if (isToday) {
              bg = 'bg-amber-300';
              aria = `${DAY_LABELS[i]} (today): not yet logged`;
            } else if (inFuture) {
              bg = 'bg-slate-100';
              aria = `${DAY_LABELS[i]}: upcoming`;
            }
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                <span
                  className={`block h-9 w-5 rounded-md ${bg} ${
                    isToday ? 'ring-2 ring-primary/30 ring-offset-1' : ''
                  }`}
                  aria-label={aria}
                  title={aria}
                />
                <span className="text-[10px] font-medium text-slate-500 tabular-nums leading-none">
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Child badges — interactive when the routine is tickable, static otherwise.
// Same physical position in the card as before; click = log/unlog for that
// (child × subject) combination so the affordance is in-context.
// ─────────────────────────────────────────────────────────────────────────

interface StaticChildBadgesProps {
  names: string[];
}

function StaticChildBadges({ names }: StaticChildBadgesProps) {
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

// ─────────────────────────────────────────────────────────────────────────
// Main widget
// ─────────────────────────────────────────────────────────────────────────

export function TodaySchedule() {
  const t = useTranslations('Dashboard');
  const tL = useTranslations('Lessons');
  const [routine, setRoutine] = useState<RoutineEntry[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const range = useMemo(summaryRange, []);
  const summary = useProgressSummary(range.from, range.to);
  const todayLogs = useDayLogs(todayISO(), summary.refetch);

  const tickLabels = useMemo(
    () => ({
      tick: (vars: { child: string; subject: string }) =>
        t('checklistTickAria', vars),
      untick: (vars: { child: string; subject: string }) =>
        t('checklistUntickAria', vars),
    }),
    [t],
  );

  const loadLessons = useCallback(async () => {
    const res = await apiFetch('/api/v1/lessons/today', { credentials: 'include' });
    if (!res.ok) throw new Error('lessons');
    return (await res.json()) as LessonSummary[];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const today = todayISO();
      const [r, e, l] = await Promise.all([
        apiFetch('/api/v1/week-planner/today', { credentials: 'include' }),
        apiFetch(`/api/v1/calendar/events?from=${today}&to=${today}`, { credentials: 'include' }),
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
      const res = await apiFetch(`/api/v1/lessons/${lesson.id}/status`, {
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
        // Picked-up lessons can produce teaching logs — keep the tick badges
        // and streak banner in sync.
        todayLogs.refetch();
        summary.refetch();
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

  const { markAllPairs, hasUntickedRoutine, hasTickableRoutine } = useMemo(() => {
    const pairs: MarkAllPair[] = [];
    let hasUnticked = false;
    let hasTickable = false;
    for (const item of timedItems) {
      if (item.kind !== 'routine') continue;
      const r = item.data;
      if (!routineCanBeTicked(r)) continue;
      hasTickable = true;
      for (const childId of r.child_ids) {
        pairs.push({
          childId,
          subjectId: r.subject_id as string,
          minutes: r.duration_minutes,
        });
        if (!todayLogs.isLogged(childId, r.subject_id as string)) {
          hasUnticked = true;
        }
      }
    }
    return {
      markAllPairs: pairs,
      hasUntickedRoutine: hasUnticked,
      hasTickableRoutine: hasTickable,
    };
  }, [timedItems, todayLogs]);

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

  function renderLessonRow(
    lesson: LessonSummary,
    opts: { accentOverride?: string; compact?: boolean } = {},
  ) {
    const { accentOverride, compact = false } = opts;
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
          <NotebookPen className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate flex-1">{lesson.title}</p>
              {!compact && <LessonStatusBadge status={lesson.status} />}
            </div>
            {!compact && (
              <p className="text-[11px] text-slate-500 truncate">
                {lesson.subject.name}
                {lesson.estimated_duration_minutes ? ` · ${formatDuration(lesson.estimated_duration_minutes)}` : ''}
              </p>
            )}
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
        <>
          <StreakBanner summary={summary.data} isLoading={summary.isLoading} />
          <div className="mt-4">
            <WidgetEmpty
              icon={<CalendarDays className="h-8 w-8" />}
              title={t('todayEmpty')}
              hint={t('todayEmptyHint')}
            />
          </div>
        </>
      )}
      {!loading && !error && hasItems && (
        <div className="space-y-4">
          <StreakBanner summary={summary.data} isLoading={summary.isLoading} />
          {hasTickableRoutine && (
            <div
              className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2"
              role="note"
            >
              <Info
                className="h-4 w-4 flex-shrink-0 text-primary mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-slate-700 leading-relaxed">
                {t.rich('badgeHint', {
                  strong: (chunks) => (
                    <strong className="font-semibold text-slate-800">{chunks}</strong>
                  ),
                })}
              </p>
            </div>
          )}
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
                  let title: string;
                  if (r.is_free_time) {
                    title = 'Free time';
                  } else if (r.subject_name) {
                    title = r.subject_name;
                  } else {
                    title = parseCustomNotes(r.notes).name;
                  }
                  const accent = r.color || (r.is_free_time ? '#94a3b8' : '#6366f1');
                  const dim = r.is_free_time && !isCurrent && !isNext ? 'opacity-70' : '';
                  const matchingLessons = lessonsForRoutine.get(r.id) || [];
                  const canTick = routineCanBeTicked(r);
                  return (
                    <li key={`routine-${r.id}`}>
                      {newHour && idx > 0 && <div className="h-2" aria-hidden />}
                      <div
                        className={`flex items-stretch rounded-lg border transition-all ${cardClass} ${dim}`}
                      >
                        <span
                          className="w-1 rounded-l-lg flex-shrink-0"
                          style={{ backgroundColor: accent }}
                          aria-hidden
                        />
                        <Link
                          href="/planner"
                          className="flex items-center gap-3 px-2 py-2.5 flex-1 min-w-0"
                        >
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
                        </Link>
                        <div className="flex items-center pr-2 pl-1">
                          {canTick ? (
                            <ChildLogBadges
                              subjectId={r.subject_id as string}
                              subjectName={r.subject_name ?? ''}
                              kids={r.child_ids.map((id, idx) => ({
                                id,
                                name: r.child_names[idx] ?? '',
                              }))}
                              durationMinutes={r.duration_minutes}
                              todayLogs={todayLogs}
                              labels={tickLabels}
                            />
                          ) : (
                            <StaticChildBadges names={r.child_names} />
                          )}
                        </div>
                      </div>
                      {matchingLessons.length > 0 && (
                        <ul className="mt-1.5 ml-4 space-y-1.5">
                          {matchingLessons.map((lesson) =>
                            renderLessonRow(lesson, { accentOverride: accent, compact: true }),
                          )}
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

          {hasTickableRoutine && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              {hasUntickedRoutine ? (
                <button
                  type="button"
                  onClick={() => todayLogs.markAll(markAllPairs)}
                  disabled={!!todayLogs.fanout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {todayLogs.fanout ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('checklistMarkAllProgress', {
                        done: todayLogs.fanout.done,
                        total: todayLogs.fanout.total,
                      })}
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-3.5 w-3.5" />
                      {t('checklistMarkAll')}
                    </>
                  )}
                </button>
              ) : (
                <p className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-success">
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t('checklistAllDone')}
                </p>
              )}
            </div>
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
