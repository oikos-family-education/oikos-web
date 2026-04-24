'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, StickyNote, LayoutList, LayoutGrid, Clock, Download } from 'lucide-react';
import { Button } from '@oikos/ui';
import { NoteCard } from './NoteCard';
import { NoteDrawer } from './NoteDrawer';
import { NoteFilters } from './NoteFilters';
import type { FiltersState } from './NoteFilters';
import { NoteBoard } from './NoteBoard';
import { NoteTimeline } from './NoteTimeline';
import type { Note, NoteListResponse, NoteStatus } from './types';

type ViewMode = 'list' | 'board' | 'timeline';
const VIEW_STORAGE_KEY = 'oikos-notes-view';

function emptyFilters(): FiltersState {
  return {
    q: '',
    statuses: [],
    entityType: null,
    pinned: false,
    overdue: false,
    tag: null,
  };
}

export function NotesPage() {
  const t = useTranslations('Notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FiltersState>(emptyFilters());

  // Load saved view mode
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'list' || saved === 'board' || saved === 'timeline') setView(saved);
  }, []);

  function updateView(v: ViewMode) {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  }

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    filters.statuses.forEach((s) => params.append('status', s));
    if (filters.entityType === 'general') {
      // We can't directly filter for "entity_type IS NULL" via current API.
      // Client-side filter handles this; don't add server param.
    } else if (filters.entityType) {
      params.set('entity_type', filters.entityType);
    }
    if (filters.pinned) params.set('pinned', 'true');
    if (filters.overdue) params.set('overdue', 'true');
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.tag) params.append('tag', filters.tag);
    params.set('limit', '200');
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/notes?${buildQueryString()}`, { credentials: 'include' });
      if (!res.ok) {
        setError(t('loadError'));
        setLoading(false);
        return;
      }
      const data: NoteListResponse = await res.json();
      let items = data.items;
      // Client-side filter for "general" (entity_type null)
      if (filters.entityType === 'general') {
        items = items.filter((n) => !n.entity_type);
      }
      setNotes(items);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, filters.entityType, t]);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notes/tags', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setAllTags(data.tags ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  function handleOpenNew() {
    setEditingNote(null);
    setDrawerOpen(true);
  }

  function handleEdit(note: Note) {
    setEditingNote(note);
    setDrawerOpen(true);
  }

  function handleSaved(_saved: Note) {
    setDrawerOpen(false);
    setEditingNote(null);
    load();
    loadTags();
  }

  async function handleDelete(note: Note) {
    const prev = notes;
    setNotes(notes.filter((n) => n.id !== note.id));
    try {
      const res = await fetch(`/api/v1/notes/${note.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        setNotes(prev);
      } else {
        loadTags();
      }
    } catch {
      setNotes(prev);
    }
  }

  async function patchNote(note: Note, body: Partial<Note>) {
    const prev = notes;
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, ...body } : n)));
    try {
      const res = await fetch(`/api/v1/notes/${note.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setNotes(prev);
      } else {
        const updated = await res.json();
        setNotes((cur) => cur.map((n) => (n.id === updated.id ? updated : n)));
      }
    } catch {
      setNotes(prev);
    }
  }

  function handleTogglePin(note: Note) {
    patchNote(note, { is_pinned: !note.is_pinned });
  }

  function handleChangeStatus(note: Note, status: NoteStatus) {
    patchNote(note, { status });
  }

  function handleExport() {
    const lines: string[] = [];
    lines.push(`# Notes export (${new Date().toISOString().slice(0, 10)})`, '');
    notes.forEach((n) => {
      lines.push('---');
      lines.push(`title: ${n.title ?? ''}`);
      lines.push(`status: ${n.status}`);
      if (n.entity_type) lines.push(`linked: ${n.entity_type}:${n.entity_label ?? n.entity_id}`);
      if (n.due_date) lines.push(`due: ${n.due_date}`);
      if (n.tags.length) lines.push(`tags: ${n.tags.join(', ')}`);
      lines.push(`created: ${n.created_at}`);
      lines.push('---');
      if (n.title) lines.push(`## ${n.title}`);
      lines.push('');
      lines.push(n.content);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEmpty = !loading && notes.length === 0;
  const hasActiveFilters =
    filters.q.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.entityType !== null ||
    filters.pinned ||
    filters.overdue ||
    filters.tag !== null;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex p-3 rounded-2xl bg-primary/10">
            <StickyNote className="w-6 h-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
            <p className="text-slate-500 mt-0.5">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            title={t('exportHint')}
            disabled={notes.length === 0}
          >
            <Download className="w-4 h-4" />
            {t('export')}
          </button>
          <Button onClick={handleOpenNew}>
            <Plus className="w-4 h-4 mr-1" />
            {t('addNote')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Filters */}
        <NoteFilters filters={filters} onChange={setFilters} allTags={allTags} />

        {/* Main */}
        <div>
          {/* View toggle */}
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => updateView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
                view === 'list'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              {t('viewList')}
            </button>
            <button
              onClick={() => updateView('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
                view === 'board'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {t('viewBoard')}
            </button>
            <button
              onClick={() => updateView('timeline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
                view === 'timeline'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              {t('viewTimeline')}
            </button>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-sm text-slate-500 py-12 text-center">…</div>
          )}

          {isEmpty && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                <StickyNote className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                {hasActiveFilters ? t('emptyFilterTitle') : t('emptyTitle')}
              </h2>
              {!hasActiveFilters && (
                <p className="text-slate-500 mt-1">{t('emptyDescription')}</p>
              )}
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters(emptyFilters())}
                  className="mt-3 text-sm text-primary hover:text-primary-hover font-medium"
                >
                  {t('clearFilters')}
                </button>
              )}
            </div>
          )}

          {!isEmpty && !loading && view === 'list' && (
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                  onChangeStatus={handleChangeStatus}
                />
              ))}
            </div>
          )}

          {!isEmpty && !loading && view === 'board' && (
            <NoteBoard notes={notes} onEdit={handleEdit} onMove={handleChangeStatus} />
          )}

          {!isEmpty && !loading && view === 'timeline' && (
            <NoteTimeline
              notes={notes}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onChangeStatus={handleChangeStatus}
            />
          )}
        </div>
      </div>

      <NoteDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingNote(null);
        }}
        onSaved={handleSaved}
        existingNote={editingNote}
      />
    </div>
  );
}
