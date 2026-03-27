'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import {
  RoutineEntryData,
  SubjectData,
  DAY_SHORTS,
  minuteToTime,
  isCustomActivity,
  parseCustomNotes,
} from './types';

interface DuplicateDaysPopupProps {
  entry: RoutineEntryData;
  subject: SubjectData | null;
  onDuplicate: (entryId: string, targetDays: number[]) => void;
  onClose: () => void;
}

export function DuplicateDaysPopup({ entry, subject, onDuplicate, onClose }: DuplicateDaysPopupProps) {
  const t = useTranslations('WeekPlanner');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const custom = isCustomActivity(entry);
  const customData = custom ? parseCustomNotes(entry.notes) : null;
  const displayName = entry.is_free_time
    ? (entry.notes ? entry.notes.split('\n')[0] : t('freeTime'))
    : custom
    ? customData!.name
    : subject?.name || 'Unknown';
  const icon = entry.is_free_time ? '🌿' : custom ? customData!.icon : subject?.icon || '';

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  function handleDuplicate() {
    if (selectedDays.length > 0) {
      onDuplicate(entry.id, selectedDays);
      onClose();
    }
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
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm mx-4"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>}
            <h2 className="text-base font-semibold text-slate-800">{t('duplicateToDays')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-slate-600">
              {displayName} · {minuteToTime(entry.start_minute)}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">{t('selectDays')}</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DAY_SHORTS.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={idx === entry.day_of_week}
                  onClick={() => toggleDay(idx)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                    idx === entry.day_of_week
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : selectedDays.includes(idx)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t(day)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
          >
            {t('cancel')}
          </button>
          <Button
            type="button"
            onClick={handleDuplicate}
            disabled={selectedDays.length === 0}
          >
            {t('duplicateAction')}
          </Button>
        </div>
      </div>
    </div>
  );
}
