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
  | { kind: 'routine'; data: RoutineEntry; sortKey: number }
  | { kind: 'event'; data: CalendarEvent; sortKey: number };

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

  const items: ScheduleItem[] = useMemo(() => {
    const list: ScheduleItem[] = [];
    if (routine) {
      for (const r of routine) {
        list.push({ kind: 'routine', data: r, sortKey: r.start_minute });
      }
    }
    if (events) {
      for (const ev of events) {
        const start = new Date(ev.start_at);
        // Use minutes-of-day for sort consistency with routine entries.
        const sortKey = ev.all_day ? -1 : start.getHours() * 60 + start.getMinutes();
        list.push({ kind: 'event', data: ev, sortKey });
      }
    }
    list.sort((a, b) => a.sortKey - b.sortKey);
    return list;
  }, [routine, events]);

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
      {!loading && !error && items.length === 0 && (
        <WidgetEmpty
          icon={<CalendarDays className="h-8 w-8" />}
          title={t('todayEmpty')}
          hint={t('todayEmptyHint')}
        />
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.map((item) => {
            if (item.kind === 'routine') {
              const r = item.data;
              const title = r.is_free_time
                ? 'Free time'
                : r.subject_name || 'Untitled';
              const dotColor = r.color || (r.is_free_time ? '#94a3b8' : '#6366f1');
              const opacity = r.is_free_time ? 'opacity-60' : '';
              return (
                <li key={`routine-${r.id}`} className={`group ${opacity}`}>
                  <Link
                    href="/planner"
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:border-primary/30 hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                      aria-hidden
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-500 w-12 flex-shrink-0">
                      {formatMinuteOfDay(r.start_minute)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {r.duration_minutes} min · {t('sourceWeekPlanner')}
                      </p>
                    </div>
                    <ChildBadges names={r.child_names} />
                  </Link>
                </li>
              );
            }
            const ev = item.data;
            const dotColor = ev.color || '#22c55e';
            const timeLabel = ev.all_day ? 'All day' : formatDateTime(ev.start_at);
            return (
              <li key={`event-${ev.id}`} className="group">
                <Link
                  href={`/calendar?event=${ev.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:border-primary/30 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden
                  />
                  <span className="text-xs font-mono tabular-nums text-slate-500 w-12 flex-shrink-0">
                    {timeLabel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                    <p className="text-[11px] text-slate-500">{t('sourceCalendar')}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
