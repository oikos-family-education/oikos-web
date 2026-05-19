'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  RoutineEntryData,
  SubjectData,
  ChildData,
  DAY_NAMES,
  ROW_HEIGHT,
  GridConfig,
  visibleDayIndices,
} from './types';
import { RoutineEntryCard } from './RoutineEntryCard';

const HEADER_HEIGHT = 40; // matches the h-10 day-header row

interface PlannerGridProps {
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  config: GridConfig;
  onEntryClick: (entry: RoutineEntryData) => void;
  onUpdateTime: (entryId: string, startMinute: number) => void;
  onResize: (entryId: string, durationMinutes: number) => void;
  onContextMenu: (e: React.MouseEvent, entryId: string) => void;
  conflictCells: Set<string>;
}

export function PlannerGrid({
  entries,
  subjects,
  childrenList,
  config,
  onEntryClick,
  onUpdateTime,
  onResize,
  onContextMenu,
  conflictCells,
}: PlannerGridProps) {
  const t = useTranslations('WeekPlanner');
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  const hours = Array.from(
    { length: config.end_hour - config.start_hour + 1 },
    (_, i) => config.start_hour + i,
  );
  const dayIndices = visibleDayIndices(config);

  // Stretch rows to fill the available height when there's room; otherwise keep the
  // baseline ROW_HEIGHT and let the grid scroll.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const usable = Math.max(0, containerHeight - HEADER_HEIGHT);
  const rowHeight = hours.length > 0
    ? Math.max(ROW_HEIGHT, usable / hours.length)
    : ROW_HEIGHT;

  // Sort entries by subject name ASC per day
  const sortedEntries = [...entries].sort((a, b) => {
    const aName = a.is_free_time ? 'zzz' : (subjects.find(s => s.id === a.subject_id)?.name || '');
    const bName = b.is_free_time ? 'zzz' : (subjects.find(s => s.id === b.subject_id)?.name || '');
    return aName.localeCompare(bName);
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-auto relative">
      <div className="inline-flex min-w-full">
        {/* Time axis column */}
        <div className="sticky left-0 z-20 bg-white border-r border-slate-200" style={{ minWidth: '72px' }}>
          <div className="border-b border-slate-200" style={{ height: `${HEADER_HEIGHT}px` }} />
          {hours.map(hour => (
            <div
              key={hour}
              className="border-b border-slate-200 relative"
              style={{ height: `${rowHeight}px` }}
            >
              <span className="absolute top-0 left-2 text-xs text-slate-500 -translate-y-1/2">
                {String(hour).padStart(2, '0')}:00
              </span>
              <div
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: `${rowHeight / 2}px` }}
              />
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dayIndices.map((dayIndex, idx) => (
          <DayColumn
            key={dayIndex}
            dayIndex={dayIndex}
            dayName={t(DAY_NAMES[dayIndex])}
            isToday={dayIndex === todayIndex}
            isLast={idx === dayIndices.length - 1}
            entries={sortedEntries.filter(e => e.day_of_week === dayIndex)}
            allEntries={sortedEntries}
            subjects={subjects}
            childrenList={childrenList}
            hours={hours}
            startHour={config.start_hour}
            endHour={config.end_hour}
            rowHeight={rowHeight}
            onEntryClick={onEntryClick}
            onUpdateTime={onUpdateTime}
            onResize={onResize}
            onContextMenu={onContextMenu}
            conflictCells={conflictCells}
          />
        ))}
      </div>
    </div>
  );
}

interface DayColumnProps {
  dayIndex: number;
  dayName: string;
  isToday: boolean;
  isLast: boolean;
  entries: RoutineEntryData[];
  allEntries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  hours: number[];
  startHour: number;
  endHour: number;
  rowHeight: number;
  onEntryClick: (entry: RoutineEntryData) => void;
  onUpdateTime: (entryId: string, startMinute: number) => void;
  onResize: (entryId: string, durationMinutes: number) => void;
  onContextMenu: (e: React.MouseEvent, entryId: string) => void;
  conflictCells: Set<string>;
}

function DayColumn({
  dayIndex,
  dayName,
  isToday,
  isLast,
  entries,
  allEntries,
  subjects,
  childrenList,
  hours,
  startHour,
  endHour,
  rowHeight,
  onEntryClick,
  onUpdateTime,
  onResize,
  onContextMenu,
  conflictCells,
}: DayColumnProps) {
  return (
    <div
      className={`flex-1 ${!isLast ? 'border-r border-slate-200' : ''}`}
      style={{ minWidth: '180px' }}
    >
      {/* Day header */}
      <div
        className={`flex items-center justify-center border-b border-slate-200 sticky top-0 z-10 text-sm font-semibold ${
          isToday ? 'bg-primary/10 text-primary' : 'bg-white text-slate-700'
        }`}
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        {dayName}
      </div>

      {/* Hour cells — split into two 30-minute droppables */}
      <div className="relative">
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <HalfHourCell
              dayIndex={dayIndex}
              hour={hour}
              minute={0}
              rowHeight={rowHeight}
              isConflict={conflictCells.has(`${dayIndex}-${hour}-0`)}
            />
            <HalfHourCell
              dayIndex={dayIndex}
              hour={hour}
              minute={30}
              rowHeight={rowHeight}
              isConflict={conflictCells.has(`${dayIndex}-${hour}-30`)}
            />
          </React.Fragment>
        ))}

        {/* Entry cards */}
        {entries.map(entry => {
          const subject = entry.subject_id
            ? subjects.find(s => s.id === entry.subject_id) || null
            : null;
          return (
            <RoutineEntryCard
              key={entry.id}
              entry={entry}
              subject={subject}
              subjects={subjects}
              childrenList={childrenList}
              allEntries={allEntries}
              startHour={startHour}
              endHour={endHour}
              rowHeight={rowHeight}
              onClick={() => onEntryClick(entry)}
              onUpdateTime={onUpdateTime}
              onResize={onResize}
              onContextMenu={onContextMenu}
            />
          );
        })}
      </div>
    </div>
  );
}

interface HalfHourCellProps {
  dayIndex: number;
  hour: number;
  minute: 0 | 30;
  rowHeight: number;
  isConflict: boolean;
}

function HalfHourCell({ dayIndex, hour, minute, rowHeight, isConflict }: HalfHourCellProps) {
  const droppableId = `cell-${dayIndex}-${hour}-${minute}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { dayIndex, hour, minute },
  });

  // Bottom half (the :30 cell) closes the hour with the darker hour-divider; the
  // top half gets a faint mid-hour divider on its bottom edge.
  const borderClass = minute === 30 ? 'border-b border-slate-200' : 'border-b border-slate-100';

  return (
    <div
      ref={setNodeRef}
      className={`${borderClass} relative transition-colors ${
        isConflict && isOver
          ? 'bg-red-50 ring-1 ring-red-400'
          : isOver
          ? 'bg-primary/10 ring-1 ring-primary'
          : ''
      }`}
      style={{ height: `${rowHeight / 2}px` }}
    />
  );
}
