'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { Pin, Plus, StickyNote } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError } from './WidgetCard';
import { QuickNoteModal } from './QuickNoteModal';
import type { Note, NoteStatus } from '../notes/types';

const COLUMN_LIMIT = 5;

type ColumnKey = 'todo' | 'in_progress' | 'to_remember';

interface ColumnDef {
  key: ColumnKey;
  status: NoteStatus;
  titleKey: 'notesColumnTodo' | 'notesColumnInProgress' | 'notesColumnRemember';
  addKey: 'notesAddTodo' | 'notesAddInProgress' | 'notesAddRemember';
  accent: string; // tailwind class for the column header strip
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'todo',
    status: 'todo',
    titleKey: 'notesColumnTodo',
    addKey: 'notesAddTodo',
    accent: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'in_progress',
    status: 'in_progress',
    titleKey: 'notesColumnInProgress',
    addKey: 'notesAddInProgress',
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'to_remember',
    status: 'to_remember',
    titleKey: 'notesColumnRemember',
    addKey: 'notesAddRemember',
    accent: 'bg-purple-100 text-purple-700',
  },
];

function formatRelativeDue(dateStr: string): string {
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `Due in ${diff}d`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(due);
}

function isOverdue(dateStr: string): boolean {
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

export function DashboardNotes() {
  const t = useTranslations('Dashboard');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [composer, setComposer] = useState<NoteStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      params.append('status', 'todo');
      params.append('status', 'in_progress');
      params.append('status', 'to_remember');
      params.set('limit', '50');
      const res = await fetch(`/api/v1/notes?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setNotes(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const buckets: Record<ColumnKey, Note[]> = { todo: [], in_progress: [], to_remember: [] };
    if (!notes) return buckets;
    for (const note of notes) {
      if (note.status === 'todo' || note.status === 'in_progress' || note.status === 'to_remember') {
        buckets[note.status].push(note);
      }
    }
    // Pinned first within each column.
    for (const key of Object.keys(buckets) as ColumnKey[]) {
      buckets[key].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    }
    return buckets;
  }, [notes]);

  const headerActions = (
    <Link
      href="/notes"
      className="text-xs font-medium text-slate-500 hover:text-primary"
    >
      {t('notesViewAll')}
    </Link>
  );

  return (
    <>
      <WidgetCard title={t('notesTitle')} actions={headerActions}>
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <WidgetSkeleton rows={3} />
            <WidgetSkeleton rows={3} />
            <WidgetSkeleton rows={3} />
          </div>
        )}
        {!loading && error && <WidgetError onRetry={load} />}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {COLUMNS.map((col) => {
              const items = grouped[col.key];
              const visible = items.slice(0, COLUMN_LIMIT);
              const more = Math.max(0, items.length - COLUMN_LIMIT);
              return (
                <div key={col.key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${col.accent}`}
                    >
                      {t(col.titleKey)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{items.length}</span>
                  </div>

                  <div className="flex-1 space-y-2 mb-2 min-h-[80px]">
                    {visible.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-[11px] text-slate-400 italic">
                        empty
                      </div>
                    )}
                    {visible.map((note) => (
                      <Link
                        key={note.id}
                        href={`/notes?id=${note.id}`}
                        className="block rounded-md border border-slate-200 bg-white p-2 hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-1.5">
                          {note.is_pinned && (
                            <Pin
                              className="h-3 w-3 text-primary flex-shrink-0 mt-0.5"
                              aria-label={t('notesPinned' as never) || 'Pinned'}
                            />
                          )}
                          <p className="text-xs text-slate-700 line-clamp-2 flex-1">
                            {note.title || note.content}
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          {note.entity_label && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[60%]">
                              {note.entity_label}
                            </span>
                          )}
                          {note.due_date && (
                            <span
                              className={`ml-auto text-[10px] font-medium ${
                                isOverdue(note.due_date) ? 'text-red-500' : 'text-slate-500'
                              }`}
                            >
                              {formatRelativeDue(note.due_date)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setComposer(col.status)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
                    >
                      <Plus className="h-3 w-3" />
                      {t(col.addKey)}
                    </button>
                    {more > 0 && (
                      <Link
                        href={`/notes?status=${col.status}`}
                        className="text-[11px] text-slate-500 hover:text-primary"
                      >
                        {t('notesMore', { count: more })}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !error && notes !== null && notes.length === 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <StickyNote className="h-4 w-4" />
            <span>No active notes — capture something to keep on your mind.</span>
          </div>
        )}
      </WidgetCard>

      <QuickNoteModal
        open={composer !== null}
        defaultStatus={composer || 'todo'}
        onClose={() => setComposer(null)}
        onCreated={load}
      />
    </>
  );
}
