'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { NoteStatus } from './types';

const STYLES: Record<NoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  todo: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  to_remember: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-slate-200 text-slate-500',
  history_only: 'bg-rose-100 text-rose-700',
};

const KEY: Record<NoteStatus, string> = {
  draft: 'statusDraft',
  todo: 'statusTodo',
  in_progress: 'statusInProgress',
  to_remember: 'statusToRemember',
  completed: 'statusCompleted',
  archived: 'statusArchived',
  history_only: 'statusHistoryOnly',
};

interface Props {
  status: NoteStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: Props) {
  const t = useTranslations('Notes');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status]} ${className}`}
    >
      {t(KEY[status])}
    </span>
  );
}

export function statusLabelKey(s: NoteStatus) {
  return KEY[s];
}
