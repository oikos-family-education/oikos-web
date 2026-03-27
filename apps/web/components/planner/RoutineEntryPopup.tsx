'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import {
  RoutineEntryData,
  SubjectData,
  ChildData,
  DAY_NAMES,
  DAY_SHORTS,
  minuteToTime,
  parseTime,
  HOURS_START,
  HOURS_END,
  MIN_DURATION,
  MAX_DURATION,
  isCustomActivity,
  parseCustomNotes,
  encodeCustomNotes,
  CUSTOM_COLORS,
} from './types';
import { EmojiPicker } from './EmojiPicker';

interface RoutineEntryPopupProps {
  entry: RoutineEntryData;
  subject: SubjectData | null;
  childrenList: ChildData[];
  allEntries: RoutineEntryData[];
  onSave: (entryId: string, updates: Partial<RoutineEntryData>) => void;
  onSaveAllDuplicates: (entry: RoutineEntryData, updates: Partial<RoutineEntryData>) => void;
  onDelete: (entryId: string) => void;
  onDeleteAllDuplicates: (entry: RoutineEntryData) => void;
  onDuplicate: (entryId: string, targetDays: number[]) => void;
  onClose: () => void;
}

export function RoutineEntryPopup({
  entry,
  subject,
  childrenList,
  allEntries,
  onSave,
  onSaveAllDuplicates,
  onDelete,
  onDeleteAllDuplicates,
  onDuplicate,
  onClose,
}: RoutineEntryPopupProps) {
  const t = useTranslations('WeekPlanner');
  const [startTime, setStartTime] = useState(minuteToTime(entry.start_minute));
  const [duration, setDuration] = useState(entry.duration_minutes);
  const [priority, setPriority] = useState(entry.priority);
  const [notes, setNotes] = useState(() => {
    if (!entry.is_free_time && !entry.subject_id && entry.notes) {
      return parseCustomNotes(entry.notes).userNotes;
    }
    return entry.notes || '';
  });
  const [deleteMode, setDeleteMode] = useState<null | 'confirm' | 'chooseScope'>(null);
  const [duplicateDays, setDuplicateDays] = useState<number[]>([]);

  const custom = isCustomActivity(entry);
  const customData = custom ? parseCustomNotes(entry.notes) : null;
  const [customName, setCustomName] = useState(customData?.name || '');
  const [customIcon, setCustomIcon] = useState(customData?.icon || '✏️');
  const [customColor, setCustomColor] = useState(entry.color || CUSTOM_COLORS[0]);

  const displayName = entry.is_free_time
    ? (entry.notes ? entry.notes.split('\n')[0] : t('freeTime'))
    : custom
    ? customData!.name
    : subject?.name || 'Unknown';
  const icon = entry.is_free_time ? '🌿' : custom ? customData!.icon : subject?.icon || '';

  const childNames = childrenList
    .filter(c => entry.child_ids.includes(c.id))
    .map(c => c.nickname || c.name)
    .join(', ');

  // Find duplicates: same subject, same children, same time, different days
  const duplicates = allEntries.filter(e =>
    e.id !== entry.id &&
    e.subject_id === entry.subject_id &&
    e.is_free_time === entry.is_free_time &&
    e.start_minute === entry.start_minute &&
    e.duration_minutes === entry.duration_minutes &&
    JSON.stringify([...e.child_ids].sort()) === JSON.stringify([...entry.child_ids].sort())
  );
  const hasDuplicates = duplicates.length > 0;
  const totalOccurrences = duplicates.length + 1;

  // Count how many times this subject appears on the grid
  const frequency = allEntries.filter(e =>
    e.subject_id === entry.subject_id && e.is_free_time === entry.is_free_time
  ).length;

  function handleSave(applyToAll: boolean) {
    const parsed = parseTime(startTime);
    if (parsed === null || parsed < HOURS_START * 60 || parsed > HOURS_END * 60) return;

    const finalNotes = custom
      ? encodeCustomNotes(customIcon, customName, notes || undefined)
      : notes || null;

    const updates: Partial<RoutineEntryData> = {
      start_minute: parsed,
      duration_minutes: Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration)),
      priority,
      notes: finalNotes,
      ...(custom ? { color: customColor } : {}),
    };

    if (applyToAll && hasDuplicates) {
      onSaveAllDuplicates(entry, updates);
    } else {
      onSave(entry.id, updates);
    }
    onClose();
  }

  function handleDelete() {
    if (!hasDuplicates) {
      if (deleteMode === 'confirm') {
        onDelete(entry.id);
        onClose();
      } else {
        setDeleteMode('confirm');
      }
    } else {
      if (deleteMode === null) {
        setDeleteMode('chooseScope');
      }
    }
  }

  function handleDeleteThis() {
    onDelete(entry.id);
    onClose();
  }

  function handleDeleteAll() {
    onDeleteAllDuplicates(entry);
    onClose();
  }

  function handleDuplicate() {
    if (duplicateDays.length > 0) {
      // Save form values first, then duplicate
      const parsed = parseTime(startTime);
      if (parsed === null || parsed < HOURS_START * 60 || parsed > HOURS_END * 60) return;

      const finalNotes = custom
        ? encodeCustomNotes(customIcon, customName, notes || undefined)
        : notes || null;

      const updates: Partial<RoutineEntryData> = {
        start_minute: parsed,
        duration_minutes: Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration)),
        priority,
        notes: finalNotes,
        ...(custom ? { color: customColor } : {}),
      };

      onSave(entry.id, updates);
      onDuplicate(entry.id, duplicateDays);
      onClose();
    }
  }

  function toggleDuplicateDay(day: number) {
    setDuplicateDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('entryDetails')}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {icon && <span className="text-2xl">{icon}</span>}
            <h2 className="text-lg font-semibold text-slate-800">{displayName}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Child */}
          {childNames && (
            <div>
              <label className="text-sm font-semibold text-slate-700">{t('childLabel')}</label>
              <p className="text-sm text-slate-600 mt-1">{childNames}</p>
            </div>
          )}

          {/* Day */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('dayLabel')}</label>
            <p className="text-sm text-slate-600 mt-1">{t(DAY_NAMES[entry.day_of_week])}</p>
          </div>

          {/* Custom activity: name, icon, color */}
          {custom && (
            <>
              <div>
                <label className="text-sm font-semibold text-slate-700">{t('customActivityName')}</label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder={t('customActivityNamePlaceholder')}
                  className="mt-1 block w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex gap-6">
                <div>
                  <label className="text-sm font-semibold text-slate-700">{t('customActivityIcon')}</label>
                  <div className="mt-1.5">
                    <EmojiPicker selected={customIcon} onSelect={setCustomIcon} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">{t('customActivityColor')}</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {CUSTOM_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          customColor === c ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Start time */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('startTimeLabel')}</label>
            <input
              type="text"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="mt-1 block w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="09:00"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('durationLabel')}</label>
            <input
              type="range"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={5}
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value))}
              className="w-full mt-2 accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>15m</span>
              <span className="font-medium text-slate-600">
                {duration >= 60
                  ? t('hours', { h: Math.floor(duration / 60), m: duration % 60 })
                  : t('minutes', { count: duration })}
              </span>
              <span>5h</span>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('priorityLabel')}</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
              className="mt-1 block w-40 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="high">{t('priorityHigh')}</option>
              <option value="medium">{t('priorityMedium')}</option>
              <option value="low">{t('priorityLow')}</option>
            </select>
          </div>

          {/* Description (read-only) */}
          {subject?.short_description && (
            <div>
              <label className="text-sm font-semibold text-slate-700">{t('descriptionLabel')}</label>
              <p className="text-sm text-slate-500 mt-1">{subject.short_description}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('notesLabel')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 block w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={2}
              placeholder={t('notesPlaceholder')}
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('frequencyLabel')}</label>
            <p className="text-sm text-slate-600 mt-1">{t('timesPerWeek', { count: frequency })}</p>
          </div>

          {/* Duplicate to days — clearly separated section */}
          <div className="border-t border-slate-100 pt-4">
            <label className="text-sm font-semibold text-slate-700">{t('duplicateToDays')}</label>
            <div className="flex gap-1 mt-1.5">
              {DAY_SHORTS.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={idx === entry.day_of_week}
                  onClick={() => toggleDuplicateDay(idx)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    idx === entry.day_of_week
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : duplicateDays.includes(idx)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t(day)}
                </button>
              ))}
            </div>
            {duplicateDays.length > 0 && (
              <Button
                type="button"
                onClick={handleDuplicate}
                className="mt-2 text-xs !px-3 !py-1.5"
              >
                {t('duplicateAction')}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4">
          {/* Delete area */}
          {deleteMode === 'chooseScope' ? (
            <div className="flex flex-col gap-2 mb-3">
              <button
                type="button"
                onClick={handleDeleteThis}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                {t('deleteThisOnly')}
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                {t('deleteConfirmAll', { count: totalOccurrences })}
              </button>
              <button
                type="button"
                onClick={() => setDeleteMode(null)}
                className="text-xs text-slate-500 hover:text-slate-700 self-start"
              >
                {t('cancel')}
              </button>
            </div>
          ) : deleteMode === 'confirm' ? (
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={handleDeleteThis}
                className="flex items-center gap-1 text-sm text-red-600 font-medium hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
                {t('deleteConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setDeleteMode(null)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 mb-3"
            >
              <Trash2 className="w-4 h-4" />
              {t('delete')}
            </button>
          )}

          {/* Save buttons */}
          <div className="flex items-center justify-end gap-2">
            {hasDuplicates && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
              >
                {t('applyToAllDays')}
              </button>
            )}
            <Button type="button" onClick={() => handleSave(false)}>
              {t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
