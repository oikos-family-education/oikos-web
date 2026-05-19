'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import {
  GRID_HOUR_MAX,
  GRID_HOUR_MIN,
  GridConfig,
  RoutineEntryData,
} from './types';

interface GridConfigPopupProps {
  config: GridConfig;
  entries: RoutineEntryData[];
  saving?: boolean;
  onSave: (config: GridConfig, deleteOutside: boolean) => Promise<void> | void;
  onClose: () => void;
}

function isEntryOutside(entry: RoutineEntryData, config: GridConfig): boolean {
  if (entry.day_of_week === 5 && !config.include_saturday) return true;
  if (entry.day_of_week === 6 && !config.include_sunday) return true;
  if (entry.start_minute < config.start_hour * 60) return true;
  if (entry.start_minute + entry.duration_minutes > config.end_hour * 60) return true;
  return false;
}

export function GridConfigPopup({ config, entries, saving, onSave, onClose }: GridConfigPopupProps) {
  const t = useTranslations('WeekPlanner');
  const [startHour, setStartHour] = useState(config.start_hour);
  const [endHour, setEndHour] = useState(config.end_hour);
  const [includeSaturday, setIncludeSaturday] = useState(config.include_saturday);
  const [includeSunday, setIncludeSunday] = useState(config.include_sunday);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pendingConfig: GridConfig = {
    start_hour: startHour,
    end_hour: endHour,
    include_saturday: includeSaturday,
    include_sunday: includeSunday,
  };

  const validationError = useMemo<string | null>(() => {
    if (startHour < GRID_HOUR_MIN || startHour > GRID_HOUR_MAX - 1) {
      return t('gridConfigStartOutOfRange', { min: GRID_HOUR_MIN, max: GRID_HOUR_MAX - 1 });
    }
    if (endHour < GRID_HOUR_MIN + 1 || endHour > GRID_HOUR_MAX) {
      return t('gridConfigEndOutOfRange', { min: GRID_HOUR_MIN + 1, max: GRID_HOUR_MAX });
    }
    if (startHour >= endHour) {
      return t('gridConfigStartAfterEnd');
    }
    return null;
  }, [startHour, endHour, t]);

  const affectedEntries = useMemo(
    () => (validationError ? [] : entries.filter(e => isEntryOutside(e, pendingConfig))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validationError, entries, startHour, endHour, includeSaturday, includeSunday],
  );

  const dirty =
    startHour !== config.start_hour ||
    endHour !== config.end_hour ||
    includeSaturday !== config.include_saturday ||
    includeSunday !== config.include_sunday;

  async function handleSave() {
    if (validationError) return;
    if (affectedEntries.length > 0 && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onSave(pendingConfig, affectedEntries.length > 0);
  }

  // Reset the confirm-delete acknowledgement if the user keeps editing.
  useEffect(() => {
    setConfirmDelete(false);
  }, [startHour, endHour, includeSaturday, includeSunday]);

  const startOptions = Array.from(
    { length: GRID_HOUR_MAX - GRID_HOUR_MIN },
    (_, i) => GRID_HOUR_MIN + i, // 6..21
  );
  const endOptions = Array.from(
    { length: GRID_HOUR_MAX - GRID_HOUR_MIN },
    (_, i) => GRID_HOUR_MIN + 1 + i, // 7..22
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md mx-4"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grid-config-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 id="grid-config-title" className="text-lg font-semibold text-slate-800">
            {t('gridConfigTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400" aria-label={t('close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <p className="text-sm text-slate-500">{t('gridConfigDescription')}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="grid-start-hour" className="text-sm font-semibold text-slate-700">
                {t('gridConfigStartHour')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                id="grid-start-hour"
                value={startHour}
                onChange={e => setStartHour(parseInt(e.target.value, 10))}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {startOptions.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="grid-end-hour" className="text-sm font-semibold text-slate-700">
                {t('gridConfigEndHour')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                id="grid-end-hour"
                value={endHour}
                onChange={e => setEndHour(parseInt(e.target.value, 10))}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {endOptions.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('gridConfigDaysIncluded')}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={e => setIncludeSaturday(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                {t('saturday')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeSunday}
                  onChange={e => setIncludeSunday(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                {t('sunday')}
              </label>
            </div>
          </div>

          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {!validationError && affectedEntries.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {t('gridConfigAffectedWarning', { count: affectedEntries.length })}
                </p>
                {confirmDelete && (
                  <p className="mt-1">{t('gridConfigConfirmDelete')}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {t('cancel')}
          </button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || !!validationError || !!saving}
            className={affectedEntries.length > 0 && confirmDelete ? '!bg-red-500 hover:!bg-red-600' : ''}
          >
            {affectedEntries.length > 0 && confirmDelete
              ? t('gridConfigDeleteAndApply')
              : t('gridConfigApply')}
          </Button>
        </div>
      </div>
    </div>
  );
}
