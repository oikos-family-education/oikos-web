'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LogEntryRow, type TeachingLogEntry } from './LogEntryRow';

interface ChildMeta { id: string; first_name: string; nickname: string | null }
interface SubjectMeta { id: string; name: string; color: string }

interface LogTabProps {
  children: ChildMeta[];
  subjects: SubjectMeta[];
  onChanged: () => void;
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function LogTab({ children, subjects, onChanged }: LogTabProps) {
  const t = useTranslations('Progress');

  const [date, setDate] = useState<string>(todayIsoDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todayEntries, setTodayEntries] = useState<TeachingLogEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [childId, setChildId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [minutes, setMinutes] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const childMeta = useMemo(
    () => children.map((c) => ({ id: c.id, name: c.nickname || c.first_name })),
    [children],
  );

  async function loadEntries() {
    setIsLoadingEntries(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      const res = await fetch(`/api/v1/progress/logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const all: TeachingLogEntry[] = await res.json();
        setTodayEntries(all);
      }
    } finally {
      setIsLoadingEntries(false);
    }
  }

  useEffect(() => {
    loadEntries();

  }, [date]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const hasAnyGeneralToday = todayEntries.some(
    (e) => e.child_id === null && e.subject_id === null,
  );

  async function postLog(body: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch('/api/v1/progress/logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) return t('duplicateLogError');
      if (!res.ok) return t('genericError');
      return null;
    } catch {
      return t('genericError');
    }
  }

  async function handleQuickLog() {
    setIsSavingQuick(true);
    setError(null);
    const err = await postLog({ taught_on: date, child_id: null, subject_id: null });
    if (err) setError(err);
    else {
      setToast(t('dayLoggedToast'));
      await loadEntries();
      onChanged();
    }
    setIsSavingQuick(false);
  }

  async function handleDetailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingDetail(true);
    setError(null);
    const body: Record<string, unknown> = {
      taught_on: date,
      child_id: childId || null,
      subject_id: subjectId || null,
    };
    if (minutes) {
      const m = parseInt(minutes, 10);
      if (!Number.isNaN(m)) body.minutes = m;
    }
    if (note.trim()) body.notes = note.trim();
    const err = await postLog(body);
    if (err) setError(err);
    else {
      setToast(t('dayLoggedToast'));
      setMinutes('');
      setNote('');
      await loadEntries();
      onChanged();
    }
    setIsSavingDetail(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/v1/progress/logs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      await loadEntries();
      onChanged();
    } else {
      setError(t('genericError'));
    }
  }

  const dateLabel = date === todayIsoDate() ? t('today', { date: formatToday() }) : date;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{dateLabel}</h2>
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            className="text-sm text-primary hover:text-primary-hover font-medium"
          >
            {t('logForDifferentDay')}
          </button>
        </div>

        {showDatePicker && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm text-slate-700 font-semibold" htmlFor="log-date">
              {t('logForDate')}
            </label>
            <input
              id="log-date"
              type="date"
              value={date}
              max={todayIsoDate()}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        )}

        <p className="text-slate-600 mb-4">{t('didYouTeachToday')}</p>

        <button
          type="button"
          onClick={handleQuickLog}
          disabled={isSavingQuick || hasAnyGeneralToday}
          className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-lg font-medium text-sm transition-colors ${
            hasAnyGeneralToday
              ? 'bg-primary/10 text-primary cursor-default'
              : 'bg-primary text-white hover:bg-primary-hover'
          } ${isSavingQuick ? 'opacity-70' : ''}`}
        >
          {isSavingQuick ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : hasAnyGeneralToday ? (
            <>
              <Check className="w-5 h-5" />
              {t('youTaughtToday')}
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {t('yesITaughtToday')}
            </>
          )}
        </button>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t('addDetailOptional')}</p>
          <form
            onSubmit={handleDetailSubmit}
            className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap"
          >
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              aria-label={t('child')}
            >
              <option value="">{t('allChildren')}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname || c.first_name}
                </option>
              ))}
            </select>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              aria-label={t('subject')}
            >
              <option value="">{t('generalTeaching')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={720}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder={t('minutesPlaceholder')}
              className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              aria-label={t('minutesPlaceholder')}
            />
            <input
              type="text"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              className="flex-1 min-w-[180px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              aria-label={t('notePlaceholder')}
            />
            <button
              type="submit"
              disabled={isSavingDetail}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
            >
              {isSavingDetail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('addEntry')}
                </>
              )}
            </button>
          </form>
          {error && <p className="text-xs font-medium text-red-500 mt-2">{error}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('todaysEntries')}</h3>
        {isLoadingEntries ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : todayEntries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noLogsYet')}</p>
        ) : (
          <div className="space-y-1">
            {todayEntries.map((e) => (
              <LogEntryRow
                key={e.id}
                entry={e}
                children={childMeta}
                subjects={subjects}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
