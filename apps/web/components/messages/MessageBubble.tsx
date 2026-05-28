'use client';

import React from 'react';
import type { MessageItemRead } from './types';

interface Props {
  message: MessageItemRead;
  mine: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A single message in a thread.
 *
 * The body is rendered as plain text in v1 (markdown-lite renderer wiring
 * is deferred — same posture as community forum's first ship of the
 * renderer). Line breaks are preserved via `whitespace-pre-wrap`.
 */
export function MessageBubble({ message, mine }: Props) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          mine
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`mt-1 text-[10px] ${
            mine ? 'text-white/70' : 'text-slate-500'
          } text-right`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
