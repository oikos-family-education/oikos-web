'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  RoutineEntryData,
  SubjectData,
  ChildData,
  DAY_NAMES,
  HOURS_START,
  HOURS_END,
  ROW_HEIGHT,
} from './types';
import { RoutineEntryCard } from './RoutineEntryCard';

interface PlannerGridProps {
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  onEntryClick: (entry: RoutineEntryData) => void;
  onUpdateTime: (entryId: string, startMinute: number) => void;
  onResize: (entryId: string, durationMinutes: number) => void;
  onContextMenu: (e: React.MouseEvent, entryId: string) => void;
  conflictCells: Set<string>;
}

const hours = Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i);

export function PlannerGrid({
  entries,
  subjects,
  childrenList,
  onEntryClick,
  onUpdateTime,
  onResize,
  onContextMenu,
  conflictCells,
}: PlannerGridProps) {
  const t = useTranslations('WeekPlanner');
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  // Sort entries by subject name ASC per day
  const sortedEntries = [...entries].sort((a, b) => {
    const aName = a.is_free_time ? 'zzz' : (subjects.find(s => s.id === a.subject_id)?.name || '');
    const bName = b.is_free_time ? 'zzz' : (subjects.find(s => s.id === b.subject_id)?.name || '');
    return aName.localeCompare(bName);
  });

  return (
    <div className="flex-1 overflow-auto relative">
      <div className="inline-flex min-w-full">
        {/* Time axis column */}
        <div className="sticky left-0 z-20 bg-white border-r border-slate-200" style={{ minWidth: '72px' }}>
          <div className="h-10 border-b border-slate-200" />
          {hours.map(hour => (
            <div
              key={hour}
              className="border-b border-slate-200 relative"
              style={{ height: `${ROW_HEIGHT}px` }}
            >
              <span className="absolute top-0 left-2 text-xs text-slate-500 -translate-y-1/2">
                {String(hour).padStart(2, '0')}:00
              </span>
              <div
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: `${ROW_HEIGHT / 2}px` }}
              />
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAY_NAMES.map((dayName, dayIndex) => (
          <DayColumn
            key={dayIndex}
            dayIndex={dayIndex}
            dayName={t(dayName)}
            isToday={dayIndex === todayIndex}
            isLast={dayIndex === 6}
            entries={sortedEntries.filter(e => e.day_of_week === dayIndex)}
            allEntries={sortedEntries}
            subjects={subjects}
            childrenList={childrenList}
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
        className={`h-10 flex items-center justify-center border-b border-slate-200 sticky top-0 z-10 text-sm font-semibold ${
          isToday ? 'bg-primary/10 text-primary' : 'bg-white text-slate-700'
        }`}
      >
        {dayName}
      </div>

      {/* Hour cells */}
      <div className="relative">
        {hours.map(hour => (
          <HourCell
            key={hour}
            dayIndex={dayIndex}
            hour={hour}
            isConflict={conflictCells.has(`${dayIndex}-${hour}`)}
          />
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

interface HourCellProps {
  dayIndex: number;
  hour: number;
  isConflict: boolean;
}

function HourCell({ dayIndex, hour, isConflict }: HourCellProps) {
  const droppableId = `cell-${dayIndex}-${hour}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { dayIndex, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-b border-slate-200 relative transition-colors ${
        isConflict && isOver
          ? 'bg-red-50 ring-1 ring-red-400'
          : isOver
          ? 'bg-primary/10 ring-1 ring-primary'
          : ''
      }`}
      style={{ height: `${ROW_HEIGHT}px` }}
    >
      <div
        className="absolute left-0 right-0 border-t border-slate-100"
        style={{ top: `${ROW_HEIGHT / 2}px` }}
      />
    </div>
  );
}
