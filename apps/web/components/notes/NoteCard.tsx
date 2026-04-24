'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pin, PinOff, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { Note, NoteStatus } from './types';
import { ALL_STATUSES } from './types';
import { statusLabelKey } from './StatusBadge';

interface Props {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onChangeStatus: (note: Note, status: NoteStatus) => void;
}

function excerpt(content: string, max = 180) {
  if (content.length <= max) return content;
  return content.slice(0, max).trim() + '…';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NoteCard({ note, onEdit, onDelete, onTogglePin, onChangeStatus }: Props) {
  const t = useTranslations('Notes');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const isOverdue =
    (note.status === 'todo' || note.status === 'in_progress') &&
    note.due_date &&
    new Date(note.due_date) < new Date(new Date().toDateString());

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 group hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={() => onTogglePin(note)}
              className="text-slate-400 hover:text-amber-500 transition-colors"
              title={note.is_pinned ? t('unpin') : t('pin')}
            >
              {note.is_pinned ? (
                <Pin className="w-4 h-4 fill-amber-400 text-amber-500" />
              ) : (
                <PinOff className="w-4 h-4" />
              )}
            </button>
            {note.title ? (
              <h3 className="font-semibold text-slate-800 truncate">{note.title}</h3>
            ) : (
              <h3 className="font-semibold text-slate-800 truncate">{excerpt(note.content, 60)}</h3>
            )}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu((v) => !v)}
                className="cursor-pointer"
                title={t('statusLabel')}
              >
                <StatusBadge status={note.status} />
              </button>
              {showStatusMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowStatusMenu(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                    {ALL_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          onChangeStatus(note, s);
                          setShowStatusMenu(false);
                        }}
                        className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                          s === note.status ? 'font-semibold text-primary' : 'text-slate-700'
                        }`}
                      >
                        {t(statusLabelKey(s))}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {note.title && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-2 mb-2">
              {excerpt(note.content)}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            {note.entity_type && note.entity_label && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5">
                {t(`entity${note.entity_type.charAt(0).toUpperCase() + note.entity_type.slice(1)}Singular`)}
                : {note.entity_label}
              </span>
            )}
            {!note.entity_type && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                {t('entityGeneral')}
              </span>
            )}
            {note.tags.map((tag) => (
              <span key={tag} className="text-slate-500">
                #{tag}
              </span>
            ))}
            {note.author_name && <span>· {t('byAuthor', { name: note.author_name })}</span>}
            {note.due_date && (
              <span
                className={
                  isOverdue
                    ? 'inline-flex items-center gap-1 text-red-500 font-medium'
                    : 'text-slate-500'
                }
              >
                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                {t('dueLabel', { date: formatDate(note.due_date) })}
              </span>
            )}
            <span className="text-slate-400 ml-auto">{formatDate(note.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5"
            title={t('edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
            title={t('delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 flex items-center justify-between gap-3 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          <div className="text-sm text-red-700">
            <strong>{t('deleteConfirmTitle')}</strong> {t('deleteConfirmMessage')}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => {
                setConfirmingDelete(false);
                onDelete(note);
              }}
              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              {t('deleteConfirmAction')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
