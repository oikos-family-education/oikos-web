'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2, Pin } from 'lucide-react';
import { Button } from '@oikos/ui';
import { ALL_STATUSES, ALL_ENTITY_TYPES } from './types';
import type { Note, NoteDraft, NoteEntityType, NoteStatus, EntityOption } from './types';
import { statusLabelKey } from './StatusBadge';
import { loadEntityOptions } from './entityLoader';

interface NoteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (note: Note) => void;
  existingNote: Note | null;
  initialEntityType?: NoteEntityType | null;
  initialEntityId?: string | null;
}

function emptyDraft(
  entityType: NoteEntityType | null = null,
  entityId: string | null = null,
): NoteDraft {
  return {
    title: '',
    content: '',
    status: 'draft',
    entity_type: entityType,
    entity_id: entityId,
    tags: [],
    is_pinned: false,
    due_date: null,
  };
}

function noteToDraft(n: Note): NoteDraft {
  return {
    id: n.id,
    title: n.title ?? '',
    content: n.content,
    status: n.status,
    entity_type: n.entity_type,
    entity_id: n.entity_id,
    tags: n.tags ?? [],
    is_pinned: n.is_pinned,
    due_date: n.due_date,
  };
}

export function NoteDrawer({
  open,
  onClose,
  onSaved,
  existingNote,
  initialEntityType = null,
  initialEntityId = null,
}: NoteDrawerProps) {
  const t = useTranslations('Notes');
  const [draft, setDraft] = useState<NoteDraft>(() =>
    existingNote ? noteToDraft(existingNote) : emptyDraft(initialEntityType, initialEntityId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(existingNote ? noteToDraft(existingNote) : emptyDraft(initialEntityType, initialEntityId));
    setError(null);
    setTagInput('');
  }, [open, existingNote, initialEntityType, initialEntityId]);

  useEffect(() => {
    if (!draft.entity_type) {
      setEntityOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingEntities(true);
    loadEntityOptions(draft.entity_type)
      .then((opts) => {
        if (!cancelled) setEntityOptions(opts);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.entity_type]);

  const isEditing = !!existingNote;
  const canSave = draft.content.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const body = {
      title: draft.title.trim() || null,
      content: draft.content,
      status: draft.status,
      entity_type: draft.entity_type,
      entity_id: draft.entity_type ? draft.entity_id : null,
      tags: draft.tags,
      is_pinned: draft.is_pinned,
      due_date: draft.due_date,
    };

    try {
      const url = isEditing ? `/api/v1/notes/${existingNote!.id}` : '/api/v1/notes';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t('saveError'));
        setSaving(false);
        return;
      }
      const saved: Note = await res.json();
      onSaved(saved);
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    if (draft.tags.includes(v)) {
      setTagInput('');
      return;
    }
    setDraft((d) => ({ ...d, tags: [...d.tags, v] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== tag) }));
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? t('editNote') : t('newNote')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('titleLabel')}</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={t('titlePlaceholder')}
              maxLength={255}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              {t('contentLabel')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder={t('contentPlaceholder')}
              rows={8}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              {t('statusLabel')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as NoteStatus }))}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(statusLabelKey(s))}
                </option>
              ))}
            </select>
          </div>

          {/* Link to entity */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">{t('entityTypeLabel')}</label>
              <select
                value={draft.entity_type ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setDraft((d) => ({ ...d, entity_type: v as NoteEntityType | null, entity_id: null }));
                }}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="">{t('linkToNone')}</option>
                {ALL_ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`entity${type.charAt(0).toUpperCase() + type.slice(1)}Singular`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">{t('linkToLabel')}</label>
              <select
                value={draft.entity_id ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, entity_id: e.target.value || null }))}
                disabled={!draft.entity_type || loadingEntities}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white disabled:opacity-50"
              >
                <option value="">
                  {!draft.entity_type
                    ? t('selectEntityTypeFirst')
                    : entityOptions.length === 0
                      ? t('noEntitiesAvailable')
                      : t('entitySelectorPlaceholder')}
                </option>
                {entityOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('tagsLabel')}</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-xs text-slate-700 px-2 py-0.5"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={t('tagsPlaceholder')}
              className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="text-sm font-semibold text-slate-700">{t('dueDateLabel')}</label>
            <input
              type="date"
              value={draft.due_date ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value || null }))}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Pin */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.is_pinned}
              onChange={(e) => setDraft((d) => ({ ...d, is_pinned: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <Pin className="w-4 h-4" />
            {t('pinNote')}
          </label>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            {t('cancel')}
          </button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              t('saveNote')
            )}
          </Button>
        </footer>
      </aside>
    </>
  );
}
