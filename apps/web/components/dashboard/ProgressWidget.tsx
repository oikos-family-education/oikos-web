'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { Flame, Plus } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError } from './WidgetCard';
import { QuickProgressModal } from './QuickProgressModal';
import { useProgressSummary } from '../../hooks/useProgressSummary';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function rangeFromTo(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(from), to: fmt(today) };
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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProgressWidget() {
  const t = useTranslations('Dashboard');
  const range = useMemo(rangeFromTo, []);
  const { data, isLoading, error, refetch } = useProgressSummary(range.from, range.to);
  const [logOpen, setLogOpen] = useState(false);

  const week = useMemo(() => getThisWeekDates(), []);
  const todayKey = isoDate(new Date());

  const heatmapByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (data) {
      for (const cell of data.heatmap) {
        map.set(cell.date, cell.count);
      }
    }
    return map;
  }, [data]);

  const streak = data?.overall_streak;
  const streakWeeks = streak?.current_weeks ?? 0;
  const hasStreak = (streak?.current_weeks ?? 0) > 0;

  const headerActions = (
    <Link
      href="/progress"
      className="text-xs font-medium text-slate-500 hover:text-primary"
    >
      {t('progressFullReport')}
    </Link>
  );

  return (
    <>
      <WidgetCard title={t('progressTitle')} actions={headerActions}>
        {isLoading && <WidgetSkeleton rows={3} />}
        {!isLoading && error && <WidgetError onRetry={refetch} />}
        {!isLoading && !error && (
          <div className="space-y-4">
            {/* Streak banner */}
            <div
              className={`flex items-center gap-3 rounded-lg p-3 ${
                hasStreak
                  ? 'bg-gradient-to-br from-orange-50 to-amber-50 border border-amber-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}
            >
              <Flame
                className={`h-7 w-7 flex-shrink-0 ${hasStreak ? 'text-orange-500' : 'text-slate-400'}`}
                aria-hidden
              />
              <div className="min-w-0">
                {hasStreak ? (
                  <>
                    <p className="text-sm font-semibold text-slate-800">
                      {t('progressStreakWeeks', { count: streakWeeks })}
                    </p>
                    {streak?.weekly_target && (
                      <p className="text-[11px] text-slate-600">
                        {streak.this_week_count} / {streak.weekly_target} this week
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600">{t('progressStreakStart')}</p>
                )}
              </div>
            </div>

            {/* This-week mini chart */}
            <div>
              <div className="flex items-center justify-between gap-1">
                {week.map((d, i) => {
                  const key = isoDate(d);
                  const count = heatmapByDate.get(key) || 0;
                  const isToday = key === todayKey;
                  const inFuture = d.getTime() > new Date(todayKey).getTime();
                  let bg = 'bg-slate-100';
                  let aria = `${DAY_LABELS[i]}: not logged`;
                  if (count > 0) {
                    bg = 'bg-primary';
                    aria = `${DAY_LABELS[i]}: ${count} ${count === 1 ? 'session' : 'sessions'}`;
                  } else if (isToday) {
                    bg = 'bg-amber-300';
                    aria = `${DAY_LABELS[i]} (today): not yet logged`;
                  } else if (inFuture) {
                    bg = 'bg-slate-50 border border-slate-100';
                    aria = `${DAY_LABELS[i]}: upcoming`;
                  }
                  return (
                    <div
                      key={key}
                      className="flex flex-1 flex-col items-center gap-1"
                      aria-label={aria}
                      title={aria}
                    >
                      <span
                        className={`block h-7 w-full rounded ${bg} ${
                          isToday ? 'ring-2 ring-primary/40' : ''
                        }`}
                      />
                      <span className="text-[10px] text-slate-500 tabular-nums">{DAY_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              {t('progressLogButton')}
            </button>
          </div>
        )}
      </WidgetCard>

      <QuickProgressModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onLogged={() => {
          setLogOpen(false);
          refetch();
        }}
      />
    </>
  );
}
