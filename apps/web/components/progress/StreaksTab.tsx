'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StreakCard } from './StreakCard';
import { TeachingHeatmap } from './TeachingHeatmap';
import type { ProgressSummary } from '../../hooks/useProgressSummary';

interface StreaksTabProps {
  summary: ProgressSummary;
}

export function StreaksTab({ summary }: StreaksTabProps) {
  const t = useTranslations('Progress');

  return (
    <div className="space-y-6">
      <StreakCard
        currentWeeks={summary.overall_streak.current_weeks}
        longestWeeks={summary.overall_streak.longest_weeks}
        weeklyTarget={summary.overall_streak.weekly_target}
        thisWeekCount={summary.overall_streak.this_week_count}
        lastMetWeekStart={summary.overall_streak.last_met_week_start}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('perChildStreaks')}</h3>
        {summary.per_child_streaks.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noPerChildStreaks')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.per_child_streaks.map((s) => {
              const target = s.weekly_target;
              const pct = target && target > 0
                ? Math.min(100, Math.round((s.this_week_count / target) * 100))
                : 0;
              return (
                <div key={s.child_id} className="flex items-center gap-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-sm inline-flex items-center justify-center">
                    {(s.first_name[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{s.first_name}</span>
                      <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                        <Flame className="w-3.5 h-3.5" />
                        {s.current_weeks ?? 0}
                      </span>
                    </div>
                    {target != null ? (
                      <>
                        <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-500">
                            {t('thisWeekInline', {
                              count: s.this_week_count,
                              target,
                            })}
                          </span>
                          <span className="text-xs text-slate-400">
                            {t('longestEver', { count: s.longest_weeks ?? 0 })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">{t('noCadenceYet')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('perSubjectStreaks')}</h3>
        {summary.per_subject_streaks.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noPerSubjectStreaks')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.per_subject_streaks.map((s) => {
              const target = s.weekly_target ?? 0;
              const pct = target > 0
                ? Math.min(100, Math.round((s.this_week_count / target) * 100))
                : 0;
              return (
                <div key={s.subject_id} className="flex items-center gap-4 py-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                        <Flame className="w-3.5 h-3.5" />
                        {s.current_weeks ?? 0}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500">
                        {t('thisWeekInline', { count: s.this_week_count, target })}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t('longestEver', { count: s.longest_weeks ?? 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('heatmap')}</h3>
        <TeachingHeatmap
          cells={summary.heatmap}
          from={summary.range.from}
          to={summary.range.to}
        />
      </div>
    </div>
  );
}
