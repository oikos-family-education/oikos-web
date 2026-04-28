'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from './Modal';
import { Loader2 } from 'lucide-react';
import type { NoteStatus } from '../notes/types';

interface QuickNoteModalProps {
  open: boolean;
  onClose: () => void;
  defaultStatus?: NoteStatus;
  onCreated?: () => void;
}

const SELECTABLE_STATUSES: NoteStatus[] = [
  'todo',
  'in_progress',
  'to_remember',
  'history_only',
];

const STATUS_LABEL: Record<NoteStatus, string> = {
  draft: 'Draft',
  todo: 'To Do',
  in_progress: 'In Progress',
  to_remember: 'To Remember',
  completed: 'Completed',
  archived: 'Archived',
  history_only: 'Journal',
};

export function QuickNoteModal({
  open,
  onClose,
  defaultStatus = 'todo',
  onCreated,
}: QuickNoteModalProps) {
  const t = useTranslations('Dashboard');

  const [content, setContent] = useState('');
  const [status, setStatus] = useState<NoteStatus>(defaultStatus);
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setContent('');
      setStatus(defaultStatus);
      setTagsInput('');
      setError(null);
    }
  }, [open, defaultStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError('Note content is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/v1/notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          status,
          tags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.detail === 'string' ? data.detail : 'Could not create note.');
        return;
      }
      onCreated?.();
      onClose();
    } catch {
      setError('Could not create note.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('quickNoteTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="quick-note-content" className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickNoteContent')}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            id="quick-note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="quick-note-status" className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickNoteStatus')}
          </label>
          <select
            id="quick-note-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as NoteStatus)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SELECTABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quick-note-tags" className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickNoteTags')}
          </label>
          <input
            id="quick-note-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="reading, math-co-op"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary-hover disabled:bg-indigo-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('quickNoteSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
