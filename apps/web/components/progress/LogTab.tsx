'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MessageSquarePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeachingLogEntry } from './LogEntryRow';

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

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Key used to look up "is there a log for (childFilter, subject)" in today's entries.
function scopeKey(childId: string | null, subjectId: string | null): string {
  return `${childId ?? '-'}::${subjectId ?? '-'}`;
}

export function LogTab({ childrenList, subjects, onChanged }: LogTabProps) {
  const t = useTranslations('Progress');

  const [date, setDate] = useState<string>(todayIsoDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [entries, setEntries] = useState<TeachingLogEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Which child is the chip row logging for? null = every child (general-child scope).
  const [childFilter, setChildFilter] = useState<string | null>(null);

  // Inline note composer state.
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  async function loadEntries(): Promise<TeachingLogEntry[]> {
    setIsLoadingEntries(true);
    try {
      const params = new URLSearchParams({ from: date, to: date });
      const res = await fetch(`/api/v1/progress/logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const all: TeachingLogEntry[] = await res.json();
        setEntries(all);
        return all;
      }
      return [];
    } finally {
      setIsLoadingEntries(false);
    }
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // Map of (child_id|-, subject_id|-) -> existing log — used to toggle chips/buttons.
  const entryMap = useMemo(() => {
    const m = new Map<string, TeachingLogEntry>();
    for (const e of entries) m.set(scopeKey(e.child_id, e.subject_id), e);
    return m;
  }, [entries]);

  const generalEntry = entryMap.get(scopeKey(null, null));
  const hasGeneral = !!generalEntry;

  async function postLog(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch('/api/v1/progress/logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) return { ok: false, message: t('duplicateLogError') };
      if (!res.ok) return { ok: false, message: t('genericError') };
      return { ok: true };
    } catch {
      return { ok: false, message: t('genericError') };
    }
  }

  async function deleteLog(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/progress/logs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function setBusy(key: string, on: boolean) {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function toggleGeneral() {
    const key = scopeKey(null, null);
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    setError(null);

    if (generalEntry) {
      const ok = await deleteLog(generalEntry.id);
      if (!ok) setError(t('genericError'));
      else {
        await loadEntries();
        onChanged();
      }
    } else {
      const { ok, message } = await postLog({ taught_on: date, child_id: null, subject_id: null });
      if (!ok) setError(message ?? t('genericError'));
      else {
        setToast(t('dayLoggedToast'));
        await loadEntries();
        onChanged();
      }
    }
    setBusy(key, false);
  }

  async function toggleSubjectChip(subjectId: string) {
    const key = scopeKey(childFilter, subjectId);
    if (busyKeys.has(key)) return;
    setBusy(key, true);
    setError(null);

    const existing = entryMap.get(key);
    if (existing) {
      const ok = await deleteLog(existing.id);
      if (!ok) setError(t('genericError'));
      else {
        await loadEntries();
        onChanged();
      }
    } else {
      const { ok, message } = await postLog({
        taught_on: date,
        child_id: childFilter,
        subject_id: subjectId,
      });
      if (!ok) setError(message ?? t('genericError'));
      else {
        setToast(t('dayLoggedToast'));
        await loadEntries();
        onChanged();
      }
    }
    setBusy(key, false);
  }

  async function handleSaveNote() {
    if (!note.trim()) {
      setNoteOpen(false);
      return;
    }
    setIsSavingNote(true);
    setError(null);
    const { ok, message } = await postLog({
      taught_on: date,
      child_id: childFilter,
      subject_id: null,
      notes: note.trim(),
    });
    if (!ok) {
      setError(message ?? t('genericError'));
    } else {
      setToast(t('noteSavedToast'));
      setNote('');
      setNoteOpen(false);
      await loadEntries();
      onChanged();
    }
    setIsSavingNote(false);
  }

  async function handleDeleteEntry(id: string) {
    const ok = await deleteLog(id);
    if (ok) {
      await loadEntries();
      onChanged();
    } else {
      setError(t('genericError'));
    }
  }

  const dateLabel = date === todayIsoDate() ? t('today', { date: formatToday() }) : date;

  const childOptions: { id: string | null; name: string }[] = useMemo(
    () => [
      { id: null, name: t('everyone') },
      ...childrenList.map((c) => ({ id: c.id, name: c.nickname || c.first_name })),
    ],
    [childrenList, t],
  );

  function childName(id: string | null): string {
    if (!id) return t('allChildren');
    const c = childrenList.find((x) => x.id === id);
    return c ? c.nickname || c.first_name : '';
  }

  function subjectMeta(id: string | null): SubjectMeta | null {
    if (!id) return null;
    return subjects.find((s) => s.id === id) ?? null;
  }

  const generalBusy = busyKeys.has(scopeKey(null, null));

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
          onClick={toggleGeneral}
          disabled={generalBusy}
          aria-pressed={hasGeneral}
          className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-lg font-medium text-sm transition-colors ${
            hasGeneral
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-primary text-white hover:bg-primary-hover'
          } ${generalBusy ? 'opacity-70' : ''}`}
        >
          {generalBusy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5" />
              {hasGeneral ? t('youTaughtToday') : t('yesITaughtToday')}
            </>
          )}
        </button>

        {subjects.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex-1 h-px bg-slate-100" />
              <span className="text-xs uppercase tracking-widest text-slate-400">
                {t('orSeparator')}
              </span>
              <span className="flex-1 h-px bg-slate-100" />
            </div>
            <p className="text-sm text-slate-500 mb-4">{t('tapSubjectsHint')}</p>

            {childrenList.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide mr-1">
                  {t('forWhomLabel')}:
                </span>
                {childOptions.map((opt) => {
                  const active = childFilter === opt.id;
                  return (
                    <button
                      key={opt.id ?? 'all'}
                      type="button"
                      onClick={() => setChildFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-primary/40'
                      }`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const key = scopeKey(childFilter, s.id);
                const logged = entryMap.has(key);
                const busy = busyKeys.has(key);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubjectChip(s.id)}
                    disabled={busy}
                    aria-pressed={logged}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                      logged
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    } ${busy ? 'opacity-70' : ''}`}
                    style={logged ? { backgroundColor: s.color } : undefined}
                  >
                    <span
                      className="inline-flex w-4 h-4 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: logged ? 'rgba(255,255,255,0.25)' : s.color,
                      }}
                    >
                      {logged ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : null}
                    </span>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {subjects.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">{t('noSubjectsYet')}</p>
        )}

        <div className="mt-6">
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
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('todaysEntries')}</h3>
        {isLoadingEntries ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noLogsYet')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => {
              const subj = subjectMeta(e.subject_id);
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
                          <span className="text-slate-500"> · {childName(e.child_id)}</span>
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
