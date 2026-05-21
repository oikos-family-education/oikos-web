'use client';

import { apiFetch } from '../../lib/apiFetch';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, MessageSquarePlus, X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeachingLogEntry } from './LogEntryRow';
import { DayLogChecklist } from './DayLogChecklist';

interface ChildMeta { id: string; first_name: string; nickname: string | null }
interface SubjectMeta { id: string; name: string; color: string }

interface LogTabProps {
  childrenList: ChildMeta[];
  subjects: SubjectMeta[];
  onChanged: () => void;
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string): string {
  // ISO YYYY-MM-DD → "Tuesday, May 19" (local interpretation).
  // We parse explicit components to avoid the "iso shifts a day in some
  // timezones" footgun of `new Date('2026-05-19')`.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const next = new Date(y, m - 1, d + deltaDays);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/** Backend rejects taught_on more than 365 days in the past. */
const MAX_PAST_DAYS = 365;

function minSelectableIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - MAX_PAST_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LogTab({ childrenList, subjects, onChanged }: LogTabProps) {
  const t = useTranslations('Progress');

  const [date, setDate] = useState<string>(todayIsoDate());
  const [entries, setEntries] = useState<TeachingLogEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Inline note composer state (creates a general note row for the day).
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      const res = await apiFetch(`/api/v1/progress/logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const all: TeachingLogEntry[] = await res.json();
        setEntries(all);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [date]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // When the checklist mutates logs, refresh both the entries list AND the
  // parent's progress summary so streaks/heatmap react immediately.
  const handleChecklistChanged = useCallback(() => {
    loadEntries();
    onChanged();
  }, [loadEntries, onChanged]);

  async function handleSaveNote() {
    if (!note.trim()) {
      setNoteOpen(false);
      return;
    }
    setIsSavingNote(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/progress/logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taught_on: date,
          child_id: null,
          subject_id: null,
          notes: note.trim(),
        }),
      });
      if (res.status === 409) {
        setError(t('duplicateLogError'));
      } else if (!res.ok) {
        setError(t('genericError'));
      } else {
        setToast(t('noteSavedToast'));
        setNote('');
        setNoteOpen(false);
        await loadEntries();
        onChanged();
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    try {
      const res = await apiFetch(`/api/v1/progress/logs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadEntries();
        onChanged();
      } else {
        setError(t('genericError'));
      }
    } catch {
      setError(t('genericError'));
    }
  }

  const dateLabel = useMemo(
    () => (date === todayIsoDate() ? t('today', { date: formatDateLabel(date) }) : formatDateLabel(date)),
    [date, t],
  );

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s] as const)), [subjects]);
  const childById = useMemo(
    () => new Map(childrenList.map((c) => [c.id, c.nickname || c.first_name] as const)),
    [childrenList],
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DayNavigator
          date={date}
          dateLabel={dateLabel}
          onDateChange={setDate}
          jumpLabel={t('jumpToDate')}
          previousLabel={t('previousDay')}
          nextLabel={t('nextDay')}
          todayLabel={t('jumpToToday')}
        />


        <DayLogChecklist
          date={date}
          childrenList={childrenList}
          subjects={subjects}
          onChanged={handleChecklistChanged}
        />

        {/* Note composer — attaches a free-form note to the day (no subject/child). */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          {!noteOpen ? (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 font-medium"
            >
              <MessageSquarePlus className="w-4 h-4" />
              {t('addNoteToggle')}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="text"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                aria-label={t('notePlaceholder')}
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={isSavingNote || !note.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm disabled:opacity-60"
              >
                {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : t('noteSaveButton')}
              </button>
              <button
                type="button"
                onClick={() => { setNoteOpen(false); setNote(''); }}
                className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs font-medium text-red-500 mt-3">{error}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          {date === todayIsoDate() ? t('todaysEntries') : t('entriesForDate')}
        </h3>
        {isLoadingEntries ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noLogsYet')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => {
              const subj = e.subject_id ? subjectById.get(e.subject_id) : null;
              const childName = e.child_id ? childById.get(e.child_id) : null;
              const isGeneral = e.child_id === null && e.subject_id === null;
              return (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subj?.color ?? '#94A3B8' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800">
                      {isGeneral ? (
                        <span className="font-medium">{t('generalLogBadge')}</span>
                      ) : (
                        <>
                          <span className="font-medium">
                            {subj?.name ?? t('generalTeaching')}
                          </span>
                          {childName && (
                            <span className="text-slate-500"> · {childName}</span>
                          )}
                        </>
                      )}
                    </div>
                    {e.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">{e.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(e.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    aria-label="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface DayNavigatorProps {
  date: string;
  dateLabel: string;
  onDateChange: (iso: string) => void;
  jumpLabel: string;
  previousLabel: string;
  nextLabel: string;
  todayLabel: string;
}

/**
 * Day navigation header: prev/next arrows around a date label, plus a calendar
 * icon that pops the native date input (for jumping farther) and a "Today"
 * shortcut shown only when we're off today. Backend rejects taught_on in the
 * future or > 365 days in the past, so we disable arrows at those edges.
 */
function DayNavigator({
  date,
  dateLabel,
  onDateChange,
  jumpLabel,
  previousLabel,
  nextLabel,
  todayLabel,
}: DayNavigatorProps) {
  const todayIso = todayIsoDate();
  const minIso = useMemo(minSelectableIsoDate, []);
  const onToday = date === todayIso;
  const atMinPast = date === minIso;
  const inputRef = useRef<HTMLInputElement>(null);

  function jumpFromPicker(value: string) {
    if (!value) return;
    if (value > todayIso) {
      onDateChange(todayIso);
      return;
    }
    if (value < minIso) {
      onDateChange(minIso);
      return;
    }
    onDateChange(value);
  }

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    // Modern browsers support showPicker(); fall back to focusing (Safari).
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 mb-6">
      <button
        type="button"
        onClick={() => onDateChange(shiftIsoDate(date, -1))}
        disabled={atMinPast}
        aria-label={previousLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
        <h2 className="text-lg font-semibold text-slate-800 truncate text-center">
          {dateLabel}
        </h2>
        <button
          type="button"
          onClick={openPicker}
          aria-label={jumpLabel}
          title={jumpLabel}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors flex-shrink-0"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
        {/* Hidden-but-functional input the calendar icon delegates to. */}
        <input
          ref={inputRef}
          type="date"
          value={date}
          max={todayIso}
          min={minIso}
          onChange={(e) => jumpFromPicker(e.target.value)}
          className="sr-only"
          aria-label={jumpLabel}
        />
      </div>

      <div className="flex items-center gap-2">
        {!onToday && (
          <button
            type="button"
            onClick={() => onDateChange(todayIso)}
            className="hidden sm:inline-flex items-center px-3 h-9 rounded-lg text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            {todayLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDateChange(shiftIsoDate(date, 1))}
          disabled={onToday}
          aria-label={nextLabel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
