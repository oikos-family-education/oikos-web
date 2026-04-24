'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusBadge, statusLabelKey } from './StatusBadge';
import type { Note, NoteStatus } from './types';
import { BOARD_STATUSES } from './types';

interface Props {
  notes: Note[];
  onEdit: (note: Note) => void;
  onMove: (note: Note, status: NoteStatus) => void;
}

export function NoteBoard({ notes, onEdit, onMove }: Props) {
  const t = useTranslations('Notes');

  const byStatus = new Map<NoteStatus, Note[]>();
  BOARD_STATUSES.forEach((s) => byStatus.set(s, []));
  notes.forEach((n) => byStatus.get(n.status)?.push(n));

  function onDragStart(e: React.DragEvent, noteId: string) {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(e: React.DragEvent, target: NoteStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const note = notes.find((n) => n.id === id);
    if (note && note.status !== target) onMove(note, target);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {BOARD_STATUSES.map((status) => {
        const items = byStatus.get(status) ?? [];
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, status)}
            className="flex-shrink-0 w-72 bg-slate-50 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <StatusBadge status={status} />
              <span className="text-xs text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              {items.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">{t('columnEmpty')}</p>
              )}
              {items.map((note) => (
                <div
                  key={note.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, note.id)}
                  onDoubleClick={() => onEdit(note)}
                  className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="text-sm font-medium text-slate-800 line-clamp-2">
                    {note.title || note.content.slice(0, 80)}
                  </div>
                  {note.entity_label && (
                    <div className="mt-1 text-xs text-slate-500">{note.entity_label}</div>
                  )}
                  {note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
