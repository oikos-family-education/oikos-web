'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import {
  ChildData,
  DAY_NAMES,
  DAY_SHORTS,
  GridConfig,
  RoutineEntryData,
  SubjectData,
  visibleDayIndices,
} from './types';
import { buildDaySchedule, stepDayIndex } from './dayView';
import { DayAgendaTable, DayResource } from './DayAgendaTable';
import { FamilyParent } from '../../hooks/useFamilyParents';

interface PlannerDayViewProps {
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  config: GridConfig;
  dayIndex: number;
  onDayChange: (dayIndex: number) => void;
  parentsById: Record<string, FamilyParent>;
  resourcesBySubject: Record<string, DayResource[]>;
}

export function PlannerDayView({
  entries,
  subjects,
  childrenList,
  config,
  dayIndex,
  onDayChange,
  parentsById,
  resourcesBySubject,
}: PlannerDayViewProps) {
  const t = useTranslations('WeekPlanner');
  const days = visibleDayIndices(config);
  const schedule = useMemo(
    () => buildDaySchedule(entries, childrenList, dayIndex),
    [entries, childrenList, dayIndex],
  );
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const dayName = t(DAY_NAMES[dayIndex]);

  return (
    <div className="flex-1 overflow-auto bg-background p-4 lg:p-6">
      {/* Day navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDayChange(stepDayIndex(config, dayIndex, -1))}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label={t('dayViewPrevious')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-slate-800 min-w-[7.5rem] text-center" aria-live="polite">
            {dayName}
          </h2>
          <button
            type="button"
            onClick={() => onDayChange(stepDayIndex(config, dayIndex, 1))}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label={t('dayViewNext')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('dayLabel')}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === dayIndex}
              onClick={() => onDayChange(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                d === dayIndex ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t(DAY_SHORTS[d])}
            </button>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
        <Eye className="w-3.5 h-3.5" />
        {t('dayViewReadOnly')}
      </p>

      {schedule.columns.length === 0 ? (
        <p className="text-sm text-slate-500 py-12 text-center">{t('noChildren')}</p>
      ) : schedule.rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <CalendarDays className="h-10 w-10 text-primary" />
          </div>
          <p className="text-slate-500">{t('dayViewEmpty', { day: dayName })}</p>
        </div>
      ) : (
        <DayAgendaTable
          schedule={schedule}
          subjectsById={subjectsById}
          parentsById={parentsById}
          resourcesBySubject={resourcesBySubject}
          childrenList={childrenList}
        />
      )}
    </div>
  );
}
