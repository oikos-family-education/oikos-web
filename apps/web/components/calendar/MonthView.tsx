'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { EventPill } from './EventPill';
import {
  CalendarEvent,
  buildMonthGrid,
  dayInEventRange,
  isSameDay,
  isSameMonth,
  toISODate,
} from './types';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function MonthView({ currentDate, events, onEventClick, onDayClick }: MonthViewProps) {
  const t = useTranslations('Calendar');
  const today = new Date();
  const days = buildMonthGrid(currentDate);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const d of days) {
      const key = toISODate(d);
      const matching = events.filter((e) => dayInEventRange(d, e));
      map.set(key, matching);
    }
    return map;
  }, [days, events]);

  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAY_KEYS.map((k) => (
          <div key={k} className="py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t(k)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 border-l border-slate-200">
        {days.map((d) => {
          const key = toISODate(d);
          const dayEvents = eventsByDay.get(key) || [];
          const isInMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, today);
          const visibleEvents = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={key}
              onClick={() => onDayClick(d)}
              className={`border-b border-r border-slate-200 p-1.5 min-h-[120px] cursor-pointer transition-colors hover:bg-slate-50 ${
                isInMonth ? 'bg-white' : 'bg-slate-50/60'
              }`}
            >
              <div className="flex justify-end mb-1">
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-primary text-white font-semibold'
                      : isInMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {visibleEvents.map((event) => (
                  <EventPill
                    key={`${event.id}-${event.start_at}`}
                    event={event}
                    onClick={() => onEventClick(event)}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDay(expandedDay === key ? null : key);
                    }}
                    className="text-[11px] text-slate-500 hover:text-primary text-left px-1"
                  >
                    {t('moreEvents', { count: overflow })}
                  </button>
                )}
              </div>
              {expandedDay === key && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 absolute z-10"
                >
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                    {dayEvents.map((event) => (
                      <EventPill
                        key={`${event.id}-${event.start_at}-all`}
                        event={event}
                        onClick={() => {
                          setExpandedDay(null);
                          onEventClick(event);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
