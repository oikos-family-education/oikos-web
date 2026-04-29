'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface TeachingLogEntry {
  id: string;
  taught_on: string;
  child_id: string | null;
  subject_id: string | null;
  minutes: number | null;
  notes: string | null;
}

interface ChildMeta { id: string; name: string }
interface SubjectMeta { id: string; name: string; color: string }

interface LogEntryRowProps {
  entry: TeachingLogEntry;
  childrenList: ChildMeta[];
  subjects: SubjectMeta[];
  onDelete: (id: string) => Promise<void>;
}

export function LogEntryRow({ entry, childrenList, subjects, onDelete }: LogEntryRowProps) {
  const t = useTranslations('Progress');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const subject = entry.subject_id ? subjects.find((s) => s.id === entry.subject_id) : null;
  const child = entry.child_id ? childrenList.find((c) => c.id === entry.child_id) : null;

  const subjectLabel = subject?.name || t('generalTeaching');
  const subjectColor = subject?.color || '#94a3b8';
  const childLabel = child?.name || t('allChildren');

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: subjectColor }}
      />
      <div className="flex-1 min-w-0 text-sm">
        <span className="text-slate-800 font-medium">{subjectLabel}</span>
        <span className="text-slate-400 mx-1.5">·</span>
        <span className="text-slate-600">{childLabel}</span>
        {entry.minutes != null && (
          <>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500">{entry.minutes}m</span>
          </>
        )}
        {entry.notes && (
          <>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500 italic truncate">&ldquo;{entry.notes}&rdquo;</span>
          </>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
          confirming ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
        }`}
        aria-label={t('confirmDeleteLog')}
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
      </button>
    </div>
  );
}
