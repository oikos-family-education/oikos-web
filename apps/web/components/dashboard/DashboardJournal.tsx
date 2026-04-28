'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { BookHeart, Plus } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';
import { QuickNoteModal } from './QuickNoteModal';
import type { Note } from '../notes/types';

const LIMIT = 3;

function formatRelativeDay(iso: string, t: (k: string) => string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dDay.getTime()) / 86400000);
  if (diff === 0) return t('journalToday');
  if (diff === 1) return t('journalYesterday');
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function DashboardJournal() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      params.append('status', 'history_only');
      params.set('sort', 'created_at_desc');
      params.set('limit', String(LIMIT));
      const res = await fetch(`/api/v1/notes?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
      >
        <Plus className="h-3 w-3" />
        {t('journalNewEntry')}
      </button>
      <Link
        href="/notes?status=history_only"
        className="text-xs font-medium text-slate-500 hover:text-primary"
      >
        {t('journalViewAll')}
      </Link>
    </>
  );

  return (
    <>
      <WidgetCard title={t('journalTitle')} actions={headerActions}>
        {loading && <WidgetSkeleton rows={3} />}
        {!loading && error && <WidgetError onRetry={load} />}
        {!loading && !error && items && items.length === 0 && (
          <WidgetEmpty
            icon={<BookHeart className="h-8 w-8" />}
            title={t('journalEmpty')}
            hint={t('journalEmptyHint')}
            cta={
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
              >
                <Plus className="h-3 w-3" />
                {t('journalEmptyHint')}
              </button>
            }
          />
        )}
        {!loading && !error && items && items.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {items.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes?id=${note.id}&status=history_only`}
                  className="group block h-full rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-amber-50/40 p-4 hover:border-rose-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 text-[11px] text-rose-700/80 font-medium">
                    <BookHeart className="h-3.5 w-3.5" />
                    <span>{formatRelativeDay(note.created_at, t)}</span>
                  </div>
                  {note.title && (
                    <p className="mt-2 text-sm font-semibold text-slate-800 line-clamp-1">
                      {note.title}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-700 line-clamp-5 whitespace-pre-line">
                    {note.content}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    {note.author_name && <span>{t('journalBy', { name: note.author_name })}</span>}
                    {note.entity_label && (
                      <span className="ml-auto truncate max-w-[60%]">{note.entity_label}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <QuickNoteModal
        open={composerOpen}
        defaultStatus="history_only"
        onClose={() => setComposerOpen(false)}
        onCreated={load}
      />
    </>
  );
}
