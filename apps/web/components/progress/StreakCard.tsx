'use client';

import React from 'react';
import { Flame, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../lib/navigation';

interface StreakCardProps {
  currentWeeks: number | null;
  longestWeeks: number | null;
  weeklyTarget: number | null;
  thisWeekCount: number;
  lastMetWeekStart?: string | null;
}

export function StreakCard({
  currentWeeks,
  longestWeeks,
  weeklyTarget,
  thisWeekCount,
  lastMetWeekStart,
}: StreakCardProps) {
  const t = useTranslations('Progress');
  const router = useRouter();

  if (weeklyTarget == null) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-slate-600">{t('noCadenceYet')}</p>
        <button
          onClick={() => router.push('/curriculums')}
          className="mt-3 text-sm font-medium text-primary hover:text-primary-hover"
        >
          {t('setCadenceLink')} →
        </button>
      </div>
    );
  }

  const pct = weeklyTarget > 0 ? Math.min(100, Math.round((thisWeekCount / weeklyTarget) * 100)) : 0;
  const thisWeekMet = thisWeekCount >= weeklyTarget;

  // Streak broken = current week NOT met AND current_weeks is 0 AND had logged history.
  const streakBroken = !thisWeekMet && (currentWeeks ?? 0) === 0 && !!lastMetWeekStart;

  const barClass = streakBroken
    ? 'bg-red-500'
    : thisWeekMet
      ? 'bg-primary'
      : 'bg-primary/60';

  const current = currentWeeks ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-4">
        {streakBroken ? (
          <CircleAlert className="w-10 h-10 text-red-500 flex-shrink-0" />
        ) : (
          <Flame className="w-10 h-10 text-primary flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-xl font-bold text-slate-800"
            aria-label={`Current streak: ${current} weeks, longest: ${longestWeeks ?? 0} weeks.`}
          >
            {current > 0
              ? t('overallStreak', { count: current })
              : t('noStreakYet')}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('thisWeekProgress', { count: thisWeekCount, target: weeklyTarget })}
          </p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${barClass} rounded-full transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {streakBroken ? (
            <p className="text-xs text-red-500 mt-2">{t('streakBroken')}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-2">
              {t('longestEver', { count: longestWeeks ?? 0 })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
