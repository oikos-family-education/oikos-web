'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCheck,
  Info,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { ChildLogBadges } from './ChildLogBadges';
import { useDayLogs, type MarkAllPair } from '../../hooks/useDayLogs';
import { useDayRows, type ChecklistRow } from '../../hooks/useDayRows';

interface ChildMeta {
  id: string;
  first_name: string;
  nickname: string | null;
}

interface SubjectMeta {
  id: string;
  name: string;
  color: string;
}

interface DayLogChecklistProps {
  /** ISO date (YYYY-MM-DD). When today, rows come from the planner. */
  date: string;
  childrenList: ChildMeta[];
  subjects: SubjectMeta[];
  /** Called after any log mutation so the parent can refetch streak/heatmap. */
  onChanged?: () => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DayLogChecklist({
  date,
  childrenList,
  subjects,
  onChanged,
}: DayLogChecklistProps) {
  const t = useTranslations('Progress');
  const tD = useTranslations('Dashboard');

  const todayLogs = useDayLogs(date, onChanged);
  const dayRows = useDayRows(date);

  const isToday = date === todayIso();

  const tickLabels = useMemo(
    () => ({
      tick: (vars: { child: string; subject: string }) =>
        tD('checklistTickAria', vars),
      untick: (vars: { child: string; subject: string }) =>
        tD('checklistUntickAria', vars),
    }),
    [tD],
  );

  // ── Ad-hoc rows: logs whose (child, subject) doesn't match any planned row.
  // We group them by subject so a single subject taught off-plan to several
  // children appears as one row (mirroring the planned-row shape).
  const adhocRows: ChecklistRow[] = useMemo(() => {
    if (dayRows.loading) return [];
    const plannedKeys = new Set<string>();
    for (const r of dayRows.rows) {
      for (const c of r.children) {
        plannedKeys.add(`${c.id}::${r.subjectId}`);
      }
    }

    const subjectById = new Map(subjects.map((s) => [s.id, s] as const));
    const childById = new Map(
      childrenList.map((c) => [c.id, c.nickname || c.first_name] as const),
    );

    const grouped = new Map<
      string,
      { subjectId: string; subjectName: string; color: string; children: { id: string; name: string }[] }
    >();
    for (const log of todayLogs.logs) {
      if (!log.child_id || !log.subject_id) continue;
      const cellKey = `${log.child_id}::${log.subject_id}`;
      if (plannedKeys.has(cellKey)) continue;
      const subj = subjectById.get(log.subject_id);
      const childName = childById.get(log.child_id);
      if (!subj || !childName) continue;
      let bucket = grouped.get(log.subject_id);
      if (!bucket) {
        bucket = {
          subjectId: log.subject_id,
          subjectName: subj.name,
          color: subj.color,
          children: [],
        };
        grouped.set(log.subject_id, bucket);
      }
      if (!bucket.children.find((c) => c.id === log.child_id)) {
        bucket.children.push({ id: log.child_id, name: childName });
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      key: `adhoc-${g.subjectId}`,
      subjectId: g.subjectId,
      subjectName: g.subjectName,
      color: g.color || '#6366f1',
      durationMinutes: 0,
      children: g.children,
      source: 'curriculum' as const,
    }));
  }, [todayLogs.logs, dayRows.rows, dayRows.loading, subjects, childrenList]);

  const { markAllPairs, hasUnticked, hasTickable } = useMemo(() => {
    const pairs: MarkAllPair[] = [];
    let unticked = false;
    let tickable = false;
    for (const row of dayRows.rows) {
      tickable = tickable || row.children.length > 0;
      for (const child of row.children) {
        pairs.push({
          childId: child.id,
          subjectId: row.subjectId,
          minutes: row.durationMinutes,
        });
        if (!todayLogs.isLogged(child.id, row.subjectId)) {
          unticked = true;
        }
      }
    }
    return { markAllPairs: pairs, hasUnticked: unticked, hasTickable: tickable };
  }, [dayRows.rows, todayLogs]);

  const allRows = useMemo(() => [...dayRows.rows, ...adhocRows], [dayRows.rows, adhocRows]);

  // ── Ad-hoc composer
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocChildId, setAdhocChildId] = useState('');
  const [adhocSubjectId, setAdhocSubjectId] = useState('');
  const [adhocSubmitting, setAdhocSubmitting] = useState(false);

  async function submitAdhoc() {
    if (!adhocChildId || !adhocSubjectId) return;
    setAdhocSubmitting(true);
    // Reuse the toggle path so optimistic state + summary refresh both run.
    await todayLogs.toggle(adhocChildId, adhocSubjectId, 0);
    setAdhocChildId('');
    setAdhocSubjectId('');
    setAdhocSubmitting(false);
  }

  // ── Render
  if (dayRows.loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-12 rounded-lg bg-slate-100" />
        <div className="h-12 rounded-lg bg-slate-100" />
        <div className="h-12 rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (dayRows.error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-600">{t('checklistError')}</p>
        <button
          type="button"
          onClick={dayRows.refetch}
          className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
        >
          {t('checklistTryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hint */}
      {hasTickable && (
        <div
          className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2"
          role="note"
        >
          <Info className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" aria-hidden />
          <p className="text-xs text-slate-700 leading-relaxed">
            {isToday ? t('checklistHintToday') : t('checklistHintPast')}
          </p>
        </div>
      )}

      {/* Rows */}
      {allRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-600">
            {isToday ? t('checklistEmptyToday') : t('checklistEmptyPast')}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {allRows.map((row) => {
            const isAdhoc = row.key.startsWith('adhoc-');
            return (
              <li
                key={row.key}
                className={`flex items-stretch rounded-lg border ${
                  isAdhoc
                    ? 'border-slate-200 bg-slate-50/50'
                    : 'border-slate-200 bg-white hover:border-primary/40'
                } transition-colors`}
              >
                <span
                  className="w-1 rounded-l-lg flex-shrink-0"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {row.subjectName}
                      </p>
                      {isAdhoc && (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 whitespace-nowrap">
                          {t('checklistAdhocTag')}
                        </span>
                      )}
                    </div>
                    {row.source === 'planner' && typeof row.startMinute === 'number' && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {formatMinuteOfDay(row.startMinute)} · {row.durationMinutes} min
                      </p>
                    )}
                    {row.source === 'curriculum' && !isAdhoc && row.durationMinutes > 0 && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {row.durationMinutes} min
                      </p>
                    )}
                  </div>
                  <ChildLogBadges
                    subjectId={row.subjectId}
                    subjectName={row.subjectName}
                    kids={row.children}
                    durationMinutes={row.durationMinutes}
                    todayLogs={todayLogs}
                    labels={tickLabels}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Mark all / All done */}
      {hasTickable && (
        <div className="flex justify-end pt-2 border-t border-slate-100">
          {hasUnticked ? (
            <button
              type="button"
              onClick={() => todayLogs.markAll(markAllPairs)}
              disabled={!!todayLogs.fanout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {todayLogs.fanout ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tD('checklistMarkAllProgress', {
                    done: todayLogs.fanout.done,
                    total: todayLogs.fanout.total,
                  })}
                </>
              ) : (
                <>
                  <CheckCheck className="h-3.5 w-3.5" />
                  {tD('checklistMarkAll')}
                </>
              )}
            </button>
          ) : (
            <p className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-success">
              <CheckCheck className="h-3.5 w-3.5" />
              {tD('checklistAllDone')}
            </p>
          )}
        </div>
      )}

      {/* Ad-hoc composer */}
      {!adhocOpen ? (
        <button
          type="button"
          onClick={() => setAdhocOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary py-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('checklistAdhocOpen')}
        </button>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              {t('checklistAdhocTitle')}
            </p>
            <button
              type="button"
              onClick={() => {
                setAdhocOpen(false);
                setAdhocChildId('');
                setAdhocSubjectId('');
              }}
              className="text-slate-400 hover:text-slate-600"
              aria-label={t('checklistAdhocClose')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={adhocChildId}
              onChange={(e) => setAdhocChildId(e.target.value)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t('checklistAdhocChildPlaceholder')}
            >
              <option value="">{t('checklistAdhocChildPlaceholder')}</option>
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname || c.first_name}
                </option>
              ))}
            </select>
            <select
              value={adhocSubjectId}
              onChange={(e) => setAdhocSubjectId(e.target.value)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t('checklistAdhocSubjectPlaceholder')}
            >
              <option value="">{t('checklistAdhocSubjectPlaceholder')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submitAdhoc}
              disabled={!adhocChildId || !adhocSubjectId || adhocSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-xs font-medium text-white hover:bg-primary-hover disabled:bg-indigo-300"
            >
              {adhocSubmitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              {t('checklistAdhocSubmit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMinuteOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
