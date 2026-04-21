'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarEvent,
  RoutineProjectionBlock,
  getEventColor,
  HOURS_START,
  HOURS_END,
  ROW_HEIGHT,
  isSameDay,
  parseServerDate,
} from './types';
import { RoutineProjectionBlockView } from './RoutineProjectionBlock';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  routineBlocks: RoutineProjectionBlock[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  showRoutine: boolean;
}

export function DayView({
  currentDate,
  events,
  routineBlocks,
  onEventClick,
  onSlotClick,
  showRoutine,
}: DayViewProps) {
  const t = useTranslations('Calendar');
  const hours = Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  const allDay = events.filter((e) => e.all_day && dayWithinRange(currentDate, e));
  const timed = events.filter((e) => !e.all_day && isSameDay(parseServerDate(e.start_at), currentDate));

  const dayRoutines = showRoutine
    ? routineBlocks.filter((b) => b.day_of_week === ((currentDate.getDay() + 6) % 7))
    : [];

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - HOURS_START * 60) / 60) * ROW_HEIGHT;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* All-day band */}
      {allDay.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/50 p-2">
          <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide">{t('allDay')}</div>
          <div className="flex flex-col gap-1">
            {allDay.map((event) => (
              <button
                key={`${event.id}-ad`}
                type="button"
                onClick={() => onEventClick(event)}
                className={`text-left rounded px-2 py-1 text-sm font-medium text-white hover:opacity-90 ${
                  event.is_system ? 'border border-dashed border-white/60' : ''
                }`}
                style={{ backgroundColor: getEventColor(event) }}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="relative grid" style={{ gridTemplateColumns: '60px 1fr' }}>
        <div className="border-r border-slate-200">
          {hours.map((h) => (
            <div key={h} style={{ height: ROW_HEIGHT }} className="text-[10px] text-slate-400 pr-2 text-right -mt-1.5">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              onClick={() => onSlotClick(currentDate, h)}
              className="border-b border-slate-100 cursor-pointer hover:bg-slate-50/60"
              style={{ height: ROW_HEIGHT }}
            />
          ))}

          {dayRoutines.map((b) => (
            <RoutineProjectionBlockView key={b.entry_id} block={b} />
          ))}

          {timed.map((event) => {
            const start = parseServerDate(event.start_at);
            const end = parseServerDate(event.end_at);
            const startMin = start.getHours() * 60 + start.getMinutes();
            const endMin = end.getHours() * 60 + end.getMinutes();
            const top = ((startMin - HOURS_START * 60) / 60) * ROW_HEIGHT;
            const heightMin = Math.max(15, endMin - startMin);
            const height = (heightMin / 60) * ROW_HEIGHT;
            return (
              <button
                key={`${event.id}-${event.start_at}`}
                type="button"
                onClick={() => onEventClick(event)}
                className={`absolute left-2 right-2 rounded px-2 py-1 text-sm font-medium text-white text-left hover:opacity-90 ${
                  event.is_system ? 'border border-dashed border-white/60' : ''
                }`}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: getEventColor(event),
                }}
              >
                <div className="truncate">{event.title}</div>
                {event.location && (
                  <div className="text-xs opacity-80 truncate">{event.location}</div>
                )}
              </button>
            );
          })}

          {isToday && nowTop >= 0 && nowTop <= (HOURS_END - HOURS_START) * ROW_HEIGHT && (
            <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top: nowTop }}>
              <div className="h-0.5 bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function dayWithinRange(day: Date, event: CalendarEvent): boolean {
  const start = parseServerDate(event.start_at);
  const end = parseServerDate(event.end_at);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return end >= dayStart && start <= dayEnd;
}
