'use client';

import React, { useEffect, useRef } from 'react';
import type { MessageItemRead } from './types';
import { MessageBubble } from './MessageBubble';

const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

interface Props {
  messages: MessageItemRead[];
  myFamilyId: string | null;
}

/**
 * Renders the message list in chronological order, oldest at top.
 *
 * Auto-scroll posture: stick to the bottom *only* while the user is already
 * at the bottom. If they have scrolled up to read history, an incoming
 * polled message must NOT yank the viewport — that would lose their place.
 * Once they scroll back to the bottom, sticky behaviour resumes.
 */
export function MessageList({ messages, myFamilyId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // True iff the user is currently at (or near) the bottom of the scroll
  // container. Updated on scroll; consulted right after each `messages`
  // change to decide whether to snap.
  const stickyRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickyRef.current = distance < STICK_TO_BOTTOM_THRESHOLD_PX;
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stickyRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} mine={m.author_family_id === myFamilyId} />
      ))}
    </div>
  );
}
