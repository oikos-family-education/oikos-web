'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  RoutineEntryData,
  SubjectData,
  ChildData,
  ROW_HEIGHT,
  HOURS_START,
  HOURS_END,
  minuteToTime,
  parseTime,
  priorityColor,
  isCustomActivity,
  parseCustomNotes,
} from './types';

interface RoutineEntryCardProps {
  entry: RoutineEntryData;
  subject: SubjectData | null;
  subjects: SubjectData[];
  childrenList: ChildData[];
  allEntries: RoutineEntryData[];
  onClick: () => void;
  onUpdateTime: (entryId: string, startMinute: number) => void;
  onResize: (entryId: string, durationMinutes: number) => void;
  onContextMenu: (e: React.MouseEvent, entryId: string) => void;
}

export function RoutineEntryCard({
  entry,
  subject,
  subjects,
  childrenList,
  allEntries,
  onClick,
  onUpdateTime,
  onResize,
  onContextMenu,
}: RoutineEntryCardProps) {
  const t = useTranslations('WeekPlanner');
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { type: 'entry', entryId: entry.id, entry },
    disabled: isResizing,
  });

  // Calculate position
  const hourRow = Math.floor(entry.start_minute / 60) - HOURS_START;
  const minuteOffset = entry.start_minute % 60;
  const topPx = hourRow * ROW_HEIGHT + (minuteOffset / 60) * ROW_HEIGHT;
  const heightPx = (entry.duration_minutes / 60) * ROW_HEIGHT;

  // Calculate width for side-by-side display
  const overlapping = allEntries.filter(e => {
    if (e.id === entry.id || e.day_of_week !== entry.day_of_week) return false;
    const eEnd = e.start_minute + e.duration_minutes;
    const entryEnd = entry.start_minute + entry.duration_minutes;
    return entry.start_minute < eEnd && entryEnd > e.start_minute;
  });

  const totalOverlapping = overlapping.length + 1;

  // Sort overlapping entries by display name (ASC) for consistent left-to-right ordering
  function resolveEntryName(e: RoutineEntryData): string {
    if (e.is_free_time) return e.notes?.split('\n')[0] || 'Free Time';
    if (isCustomActivity(e)) return parseCustomNotes(e.notes).name;
    return subjects.find(s => s.id === e.subject_id)?.name || '';
  }
  const allOverlapping = [entry, ...overlapping];
  const sortedIds = allOverlapping
    .map(e => ({ id: e.id, name: resolveEntryName(e) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(x => x.id);
  const slotIndex = sortedIds.indexOf(entry.id);
  const widthPercent = 100 / totalOverlapping;
  const leftPercent = slotIndex * widthPercent;

  const color = entry.color || subject?.color || '#6366F1';
  const priority = entry.priority;

  // Display name and icon based on entry type
  const custom = isCustomActivity(entry);
  const customData = custom ? parseCustomNotes(entry.notes) : null;
  const displayName = entry.is_free_time
    ? (entry.notes ? entry.notes.split('\n')[0] : t('freeTime'))
    : custom
    ? customData!.name
    : subject?.name || 'Unknown';
  const childNames = childrenList
    .filter(c => entry.child_ids.includes(c.id))
    .map(c => c.nickname || c.name)
    .join(', ');

  const durationDisplay =
    entry.duration_minutes >= 60
      ? t('hours', { h: Math.floor(entry.duration_minutes / 60), m: entry.duration_minutes % 60 })
      : t('minutes', { count: entry.duration_minutes });

  // Inline time editing
  useEffect(() => {
    if (editingTime && timeInputRef.current) {
      timeInputRef.current.focus();
      timeInputRef.current.select();
    }
  }, [editingTime]);

  function handleTimeClick(e: React.MouseEvent) {
    e.stopPropagation();
    setTimeValue(minuteToTime(entry.start_minute));
    setEditingTime(true);
  }

  function handleTimeConfirm() {
    const parsed = parseTime(timeValue);
    if (parsed !== null && parsed >= HOURS_START * 60 && parsed <= HOURS_END * 60) {
      onUpdateTime(entry.id, parsed);
    }
    setEditingTime(false);
  }

  function handleTimeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleTimeConfirm();
    if (e.key === 'Escape') setEditingTime(false);
  }

  // Resize via bottom handle — completely separated from drag
  const onResizeCallback = useCallback(onResize, [onResize]);

  useEffect(() => {
    const handle = resizeRef.current;
    if (!handle) return;

    let startY = 0;
    let startDuration = entry.duration_minutes;

    function onMouseDown(e: MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
      startY = e.clientY;
      startDuration = entry.duration_minutes;
      setIsResizing(true);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e: MouseEvent) {
      e.preventDefault();
      const deltaY = e.clientY - startY;
      const deltaMinutes = Math.round((deltaY / ROW_HEIGHT) * 60 / 15) * 15;
      const newDuration = Math.max(15, Math.min(300, startDuration + deltaMinutes));
      const maxDuration = (HOURS_END * 60) - entry.start_minute;
      onResizeCallback(entry.id, Math.min(newDuration, maxDuration));
    }

    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, [entry.id, entry.duration_minutes, entry.start_minute, onResizeCallback]);

  return (
    <div
      ref={setNodeRef}
      {...(isResizing ? {} : listeners)}
      {...attributes}
      className={`absolute rounded-md shadow-sm select-none overflow-hidden transition-opacity ${
        isDragging ? 'opacity-50 z-50' : isResizing ? 'z-30 ring-2 ring-primary/30' : 'z-10'
      } ${entry.is_free_time ? 'border border-dashed border-green-300' : custom ? 'border border-dashed' : 'border border-slate-200'}`}
      style={{
        top: `${topPx}px`,
        height: `${Math.max(heightPx, 24)}px`,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        backgroundColor: entry.is_free_time ? '#f0fdf4' : custom ? `${color}10` : `${color}10`,
        ...(custom ? { borderColor: color } : {}),
        borderLeftWidth: entry.is_free_time ? undefined : '4px',
        borderLeftColor: entry.is_free_time ? undefined : color,
        cursor: isResizing ? 'ns-resize' : 'pointer',
      }}
      onClick={(e) => {
        if (isResizing) return;
        e.stopPropagation();
        onClick();
      }}
      onContextMenu={(e) => onContextMenu(e, entry.id)}
      aria-label={`${displayName}${childNames ? ` for ${childNames}` : ''}, ${minuteToTime(entry.start_minute)}, ${entry.duration_minutes} minutes`}
    >
      <div className="p-1.5 h-full flex flex-col">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-semibold text-slate-800 truncate">{displayName}</span>
        </div>

        {heightPx >= 36 && (
          <div className="flex items-center gap-1 mt-0.5">
            {editingTime ? (
              <input
                ref={timeInputRef}
                type="text"
                value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                onBlur={handleTimeConfirm}
                onKeyDown={handleTimeKeyDown}
                className="w-12 text-xs bg-white border border-slate-300 rounded px-1 py-0 focus:ring-1 focus:ring-primary"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <button
                onClick={handleTimeClick}
                className="text-xs text-slate-600 hover:text-primary hover:underline"
              >
                {minuteToTime(entry.start_minute)}
              </button>
            )}
            <span className="text-xs text-slate-500">· {durationDisplay}</span>
          </div>
        )}

        {heightPx >= 52 && childNames && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-slate-500 truncate">{childNames}</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColor(priority)}`} />
          </div>
        )}
      </div>

      {/* Resize handle — larger touch target, no drag listener */}
      <div
        ref={resizeRef}
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize group"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="mx-auto w-8 h-1 rounded-full bg-slate-300 mt-1.5 group-hover:bg-slate-400 transition-colors" />
      </div>
    </div>
  );
}
