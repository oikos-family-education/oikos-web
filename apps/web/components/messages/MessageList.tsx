'use client';

import React, { useEffect, useRef } from 'react';
import type { MessageItemRead } from './types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: MessageItemRead[];
  myFamilyId: string | null;
}

/**
 * Renders the message list in chronological order, oldest at top.
 * Auto-scrolls to the bottom whenever a new message arrives.
 */
export function MessageList({ messages, myFamilyId }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} mine={m.author_family_id === myFamilyId} />
      ))}
    </div>
  );
}
