'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarEvent,
  RoutineProjectionBlock,
  buildWeekDays,
  getEventColor,
  HOURS_START,
  HOURS_END,
  ROW_HEIGHT,
  isSameDay,
  layoutRoutineBlocks,
  layoutTimedEvents,
  parseServerDate,
  toISODate,
} from './types';
import { RoutineProjectionBlockView } from './RoutineProjectionBlock';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  routineBlocks: RoutineProjectionBlock[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  showRoutine: boolean;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function WeekView({
  currentDate,
  events,
  routineBlocks,
  onEventClick,
  onSlotClick,
  showRoutine,
}: WeekViewProps) {
  const t = useTranslations('Calendar');
  const days = buildWeekDays(currentDate);
  const today = new Date();
  const hours = Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i);

  // Group events by day
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>();
    for (const day of days) {
      map.set(toISODate(day), { allDay: [], timed: [] });
    }
    for (const event of events) {
      const start = parseServerDate(event.start_at);
      for (const day of days) {
        if (isSameDay(start, day) || (event.all_day && dayWithinRange(day, event))) {
          const bucket = map.get(toISODate(day))!;
          if (event.all_day) bucket.allDay.push(event);
          else if (isSameDay(start, day)) bucket.timed.push(event);
        }
      }
    }
    return map;
  }, [days, events]);

  const routineByDay = React.useMemo(() => {
    const map = new Map<number, RoutineProjectionBlock[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const b of routineBlocks) {
      const dow = b.day_of_week;
      if (map.has(dow)) map.get(dow)!.push(b);
    }
    return map;
  }, [routineBlocks]);

  // Current time indicator
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - HOURS_START * 60) / 60) * ROW_HEIGHT;
  const todayIndex = days.findIndex((d) => isSameDay(d, today));

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header with day names */}
      <div className="grid sticky top-0 z-10 bg-white border-b border-slate-200" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className="py-2 text-center border-l border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase">{t(WEEKDAY_KEYS[i])}</div>
              <div
                className={`text-lg mt-0.5 ${
                  isToday ? 'text-primary font-bold' : 'text-slate-800'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day band */}
      <div className="grid border-b border-slate-200 bg-slate-50/50" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div className="text-[10px] text-slate-400 px-1 py-1 flex items-center justify-end">
          {t('allDay')}
        </div>
        {days.map((d, i) => {
          const bucket = eventsByDay.get(toISODate(d));
          const allDay = bucket?.allDay || [];
          return (
            <div key={i} className="border-l border-slate-100 p-1 min-h-[28px] flex flex-col gap-0.5">
              {allDay.map((event) => (
                <button
                  key={`${event.id}-ad`}
                  type="button"
                  onClick={() => onEventClick(event)}
                  className={`w-full text-left truncate rounded px-1.5 text-[11px] font-medium text-white hover:opacity-90 ${
                    event.is_system ? 'border border-dashed border-white/60' : ''
                  }`}
                  style={{ backgroundColor: getEventColor(event) }}
                >
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        {/* Time gutter */}
        <div className="border-r border-slate-200">
          {hours.map((h) => (
            <div key={h} style={{ height: ROW_HEIGHT }} className="text-[10px] text-slate-400 pr-2 text-right">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, dayIdx) => {
          const bucket = eventsByDay.get(toISODate(d));
          const timed = bucket?.timed || [];
          const routines = showRoutine ? (routineByDay.get(dayIdx) || []) : [];
          return (
            <div key={dayIdx} className="relative border-l border-slate-100">
              {/* Hour slots (clickable) */}
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => onSlotClick(d, h)}
                  className="border-b border-slate-100 cursor-pointer hover:bg-slate-50/60"
                  style={{ height: ROW_HEIGHT }}
                />
              ))}

              {/* Routine projection blocks (underlay) */}
              {layoutRoutineBlocks(routines).map(({ block, column, columns }) => (
                <RoutineProjectionBlockView
                  key={block.entry_id + dayIdx}
                  block={block}
                  column={column}
                  columns={columns}
                />
              ))}

              {/* Timed events */}
              {layoutTimedEvents(timed).map(({ event, startMin, endMin, column, columns }) => {
                const top = ((startMin - HOURS_START * 60) / 60) * ROW_HEIGHT;
                const height = ((endMin - startMin) / 60) * ROW_HEIGHT;
                const widthPct = 100 / columns;
                const leftPct = column * widthPct;

                return (
                  <button
                    key={`${event.id}-${event.start_at}`}
                    type="button"
                    onClick={() => onEventClick(event)}
                    className={`absolute rounded px-1.5 py-0.5 text-[11px] font-medium text-white text-left truncate hover:opacity-90 ${
                      event.is_system ? 'border border-dashed border-white/60' : ''
                    }`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      backgroundColor: getEventColor(event),
                    }}
                  >
                    <div className="truncate">{event.title}</div>
                  </button>
                );
              })}

              {/* Current time indicator */}
              {dayIdx === todayIndex && nowTop >= 0 && nowTop <= (HOURS_END - HOURS_START) * ROW_HEIGHT && (
                <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top: nowTop }}>
                  <div className="h-0.5 bg-red-500" />
                </div>
              )}
            </div>
          );
        })}
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
