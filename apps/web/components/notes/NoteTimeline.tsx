'use client';

import React from 'react';
import { NoteCard } from './NoteCard';
import type { Note, NoteStatus } from './types';

interface Props {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onChangeStatus: (note: Note, status: NoteStatus) => void;
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function NoteTimeline({ notes, onEdit, onDelete, onTogglePin, onChangeStatus }: Props) {
  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const groups = new Map<string, Note[]>();
  for (const n of sorted) {
    const key = dayKey(n.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([key, items]) => (
        <div key={key}>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">{formatDay(items[0].created_at)}</h3>
          <div className="space-y-2">
            {items.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={onEdit}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
                onChangeStatus={onChangeStatus}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
