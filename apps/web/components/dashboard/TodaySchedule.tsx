'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { CalendarDays, LayoutGrid, Calendar as CalendarIcon, Users } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';

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
  | { kind: 'routine'; data: RoutineEntry; sortKey: number; startMinute: number }
  | { kind: 'event'; data: CalendarEvent; sortKey: number; startMinute: number };

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
  const [routine, setRoutine] = useState<RoutineEntry[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const today = todayISO();
      const [r, e] = await Promise.all([
        fetch('/api/v1/week-planner/today', { credentials: 'include' }),
        fetch(`/api/v1/calendar/events?from=${today}&to=${today}`, { credentials: 'include' }),
      ]);
      if (!r.ok || !e.ok) {
        setError(true);
        return;
      }
      const rData: RoutineEntry[] = await r.json();
      const eData = await e.json();
      setRoutine(rData);
      setEvents(eData?.events || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        const minute = start.getHours() * 60 + start.getMinutes();
        timed.push({ kind: 'event', data: ev, sortKey: minute, startMinute: minute });
      }
    }
    timed.sort((a, b) => a.sortKey - b.sortKey);
    return { allDayEvents: allDay, timedItems: timed };
  }, [routine, events]);

  const hasItems = allDayEvents.length > 0 || timedItems.length > 0;

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
    </>
  );

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

                if (item.kind === 'routine') {
                  const r = item.data;
                  const title = r.is_free_time ? 'Free time' : r.subject_name || 'Untitled';
                  const accent = r.color || (r.is_free_time ? '#94a3b8' : '#6366f1');
                  const dim = r.is_free_time ? 'opacity-70' : '';
                  return (
                    <li key={`routine-${r.id}`}>
                      {newHour && idx > 0 && <div className="h-2" aria-hidden />}
                      <Link
                        href="/planner"
                        className={`flex items-stretch gap-3 rounded-lg border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all ${dim}`}
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
                            <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {t('sourceWeekPlanner')}
                            </p>
                          </div>
                          <ChildBadges names={r.child_names} />
                        </div>
                      </Link>
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
                      className="flex items-stretch gap-3 rounded-lg border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all"
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
                          <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
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
        </div>
      )}
    </WidgetCard>
  );
}
