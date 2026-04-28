'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from './Modal';
import { Loader2 } from 'lucide-react';

interface ChildOption {
  id: string;
  first_name: string;
  nickname: string | null;
}

interface SubjectOption {
  id: string;
  name: string;
  color: string;
}

interface QuickProgressModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful POST so widgets that depend on logs can refresh. */
  onLogged?: () => void;
}

export function QuickProgressModal({ open, onClose, onLogged }: QuickProgressModalProps) {
  const t = useTranslations('Dashboard');

  const [children, setChildren] = useState<ChildOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [childId, setChildId] = useState<string>(''); // '' = all children
  const [subjectId, setSubjectId] = useState<string>(''); // '' = general
  const [minutes, setMinutes] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load options once when first opened.
  useEffect(() => {
    if (!open || (children.length > 0 && subjects.length > 0)) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/v1/families/me/children', { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch('/api/v1/subjects?source=mine', { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([c, s]) => {
        if (cancelled) return;
        setChildren(Array.isArray(c) ? c : []);
        setSubjects(Array.isArray(s) ? s : []);
      })
      .catch(() => {
        /* ignore — keep dropdowns empty */
      });
    return () => {
      cancelled = true;
    };
  }, [open, children.length, subjects.length]);

  // Reset form fields when reopening.
  useEffect(() => {
    if (open) {
      setChildId('');
      setSubjectId('');
      setMinutes('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const todayLocal = new Date();
      const yyyy = todayLocal.getFullYear();
      const mm = String(todayLocal.getMonth() + 1).padStart(2, '0');
      const dd = String(todayLocal.getDate()).padStart(2, '0');
      const taught_on = `${yyyy}-${mm}-${dd}`;

      const body = {
        taught_on,
        child_id: childId || null,
        subject_id: subjectId || null,
        minutes: minutes ? Number(minutes) : null,
        notes: notes || null,
      };

      const res = await fetch('/api/v1/progress/logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.detail === 'string' ? data.detail : 'Could not log session.');
        return;
      }

      onLogged?.();
      onClose();
    } catch {
      setError('Could not log session.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('quickLogTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickLogChild')}
          </label>
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('quickLogAllChildren')}</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname || c.first_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickLogSubject')}
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— General —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quick-log-minutes" className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickLogMinutes')}
          </label>
          <input
            id="quick-log-minutes"
            type="number"
            min={1}
            max={720}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="45"
          />
        </div>

        <div>
          <label htmlFor="quick-log-notes" className="block text-sm font-semibold text-slate-700 mb-1">
            {t('quickLogNotes')}
          </label>
          <textarea
            id="quick-log-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
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
            {t('quickLogSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
