'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from './types';

interface MiniCalendarProps {
  value: Date;
  onChange: (date: Date) => void;
  daysWithEvents: Set<string>;
}

const MONTH_KEYS = [
  'monthJanuary', 'monthFebruary', 'monthMarch', 'monthApril', 'monthMay', 'monthJune',
  'monthJuly', 'monthAugust', 'monthSeptember', 'monthOctober', 'monthNovember', 'monthDecember',
] as const;

const WEEKDAY_KEYS = ['monShort', 'tueShort', 'wedShort', 'thuShort', 'friShort', 'satShort', 'sunShort'] as const;

export function MiniCalendar({ value, onChange, daysWithEvents }: MiniCalendarProps) {
  const t = useTranslations('Calendar');
  const [shown, setShown] = React.useState<Date>(startOfMonth(value));
  const today = new Date();

  React.useEffect(() => {
    setShown(startOfMonth(value));
  }, [value]);

  const days = buildMonthGrid(shown);

  function dateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setShown(addMonths(shown, -1))}
          className="p-1 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-slate-800">
          {t(MONTH_KEYS[shown.getMonth()])} {shown.getFullYear()}
        </div>
        <button
          type="button"
          onClick={() => setShown(addMonths(shown, 1))}
          className="p-1 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_KEYS.map((k) => (
          <div key={k} className="text-center text-[10px] font-medium text-slate-400 py-1">
            {t(k)}
          </div>
        ))}
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, value);
          const isInMonth = isSameMonth(d, shown);
          const hasEvents = daysWithEvents.has(dateKey(d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onChange(d)}
              className={`relative w-7 h-7 flex items-center justify-center text-xs rounded transition-colors ${
                isSelected
                  ? 'bg-primary text-white font-semibold'
                  : isToday
                  ? 'bg-primary/10 text-primary font-semibold'
                  : isInMonth
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-50'
              }`}
            >
              {d.getDate()}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(new Date())}
        className="w-full mt-3 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
      >
        {t('today')}
      </button>
    </div>
  );
}
