'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link, useRouter } from '../../../../../lib/navigation';
import { apiFetch } from '../../../../../lib/apiFetch';
import { useAuth } from '../../../../../providers/AuthProvider';
import { MessageInbox } from '../../../../../components/messages/MessageInbox';
import { ThreadHeader } from '../../../../../components/messages/ThreadHeader';
import { MessageList } from '../../../../../components/messages/MessageList';
import { Composer } from '../../../../../components/messages/Composer';
import { BlockConfirmDialog } from '../../../../../components/messages/BlockConfirmDialog';
import { ReportDialog } from '../../../../../components/messages/ReportDialog';
import { mergeMessages } from '../../../../../components/messages/merge';
import type {
  InboxFilter,
  InboxPage,
  MessageItemRead,
  ThreadDetail,
} from '../../../../../components/messages/types';

const POLL_INTERVAL_MS = 10_000;

/**
 * Apply a thread response to current state. Used both for the initial load
 * and for every polling delta:
 *   - Initial load: `current` is null, so we adopt the response wholesale.
 *   - Poll: we keep the existing message list, append any new messages
 *     from the response (dedupe by id), and sync the side-state fields
 *     (can_send, blocked_by_*, mute, last_read_at). We *never* drop
 *     locally-known messages — only add.
 */
function applyThreadResponse(
  current: ThreadDetail | null,
  incoming: ThreadDetail,
): ThreadDetail {
  if (!current) return incoming;
  const messages = mergeMessages(current.messages, incoming.messages);
  return {
    ...current,
    can_send: incoming.can_send,
    blocked_by_me: incoming.blocked_by_me,
    blocked_by_them: incoming.blocked_by_them,
    notifications_muted: incoming.notifications_muted,
    last_read_at: incoming.last_read_at,
    other_family: incoming.other_family,
    messages,
  };
}

export default function ThreadPage() {
  const t = useTranslations('Messages');
  const params = useParams();
  const router = useRouter();
  const { family } = useAuth();
  const threadId = params.threadId as string;

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [inbox, setInbox] = useState<InboxPage | null>(null);

  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const myFamilyId = family?.id ?? null;

  // The poll cursor: ISO string of the chronologically-latest message we
  // already have in state. A ref so the setInterval callback can read the
  // current value without re-binding on every render (avoids stale closures
  // and stale-cursor bugs).
  const cursorRef = useRef<string | null>(null);

  // Refs for stable identifiers so the polling effect doesn't need to
  // re-key when these strings change in a render-cycle.
  const myFamilyIdRef = useRef<string | null>(myFamilyId);
  useEffect(() => {
    myFamilyIdRef.current = myFamilyId;
  }, [myFamilyId]);

  // Keep cursorRef in sync with the latest message in state.
  useEffect(() => {
    if (!thread || thread.messages.length === 0) {
      cursorRef.current = null;
      return;
    }
    const last = thread.messages[thread.messages.length - 1];
    cursorRef.current = last.created_at;
  }, [thread]);

  const fetchThread = useCallback(async () => {
    setLoadingThread(true);
    try {
      const res = await apiFetch(`/api/v1/messages/threads/${threadId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data: ThreadDetail = await res.json();
        setThread((cur) => applyThreadResponse(cur, data));
        // Mark read.
        await apiFetch(`/api/v1/messages/threads/${threadId}/read`, {
          method: 'POST',
        });
      }
    } finally {
      setLoadingThread(false);
    }
  }, [threadId]);

  const fetchInbox = useCallback(async (f: InboxFilter) => {
    const res = await apiFetch(`/api/v1/messages/threads?filter=${f}`);
    if (res.ok) {
      const json: InboxPage = await res.json();
      setInbox(json);
    }
  }, []);

  useEffect(() => {
    // Reset state when navigating to a different thread.
    setThread(null);
    setNotFound(false);
    cursorRef.current = null;
    fetchThread();
  }, [fetchThread]);

  useEffect(() => {
    fetchInbox(filter);
  }, [filter, fetchInbox]);

  // ── Polling: every 10s while the thread is open + tab visible ────────
  //
  // Strategy:
  //   * One setInterval, but the callback no-ops when the tab is hidden.
  //   * `visibilitychange` triggers an immediate poll on becoming visible
  //     so messages that arrived while backgrounded show up at once.
  //   * The cursor lives in a ref kept in sync via a separate effect;
  //     this keeps the interval callback closure-stable across renders.
  //   * `cancelled` guards against setState after unmount or thread switch.
  //   * Mark-read only fires when the poll brought *new incoming* messages,
  //     not on every empty tick.
  useEffect(() => {
    if (!threadId) return;
    if (notFound) return;
    let cancelled = false;

    async function pollOnce() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const cursor = cursorRef.current;
      // Until we have at least one message in state, the initial load is
      // still in flight (or this is a brand-new empty thread). Skip the
      // delta — there's nothing meaningful to ask for.
      if (!cursor) return;

      try {
        const res = await apiFetch(
          `/api/v1/messages/threads/${threadId}?after=${encodeURIComponent(cursor)}`,
        );
        if (cancelled || !res.ok) return;
        const data: ThreadDetail = await res.json();

        // Identify *new* incoming messages BEFORE merging (so we can
        // decide whether to mark-read).
        const myId = myFamilyIdRef.current;
        const newIncoming = data.messages.filter(
          (m) => m.author_family_id !== myId,
        );

        setThread((cur) => applyThreadResponse(cur, data));

        if (newIncoming.length > 0) {
          // Fire-and-forget read marking. Errors are non-fatal.
          apiFetch(`/api/v1/messages/threads/${threadId}/read`, {
            method: 'POST',
          }).catch(() => undefined);
        }
      } catch {
        // Network blip — just try again on the next tick.
      }
    }

    const id = setInterval(pollOnce, POLL_INTERVAL_MS);
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        // Catch up immediately; the interval continues on its own cadence.
        pollOnce();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [threadId, notFound]);

  async function send(body: string) {
    const res = await apiFetch(
      `/api/v1/messages/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      },
    );
    if (res.ok) {
      const msg: MessageItemRead = await res.json();
      // Same merge path as the poll: dedupes by id, so if a concurrent
      // poll already pulled this row, we don't double-render.
      setThread((cur) =>
        cur
          ? { ...cur, messages: mergeMessages(cur.messages, [msg]) }
          : cur,
      );
      // Refresh inbox excerpt
      fetchInbox(filter);
    }
  }

  async function toggleMute() {
    if (!thread) return;
    const next = !thread.notifications_muted;
    const res = await apiFetch(
      `/api/v1/messages/threads/${threadId}/mute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: next }),
      },
    );
    if (res.ok) {
      setThread((cur) => (cur ? { ...cur, notifications_muted: next } : cur));
    }
  }

  async function deleteThread() {
    const res = await apiFetch(`/api/v1/messages/threads/${threadId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      router.push('/messages');
    }
  }

  if (notFound) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/messages"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <h1 className="text-lg font-semibold text-slate-800">
            {t('unavailableTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-2">{t('unavailableBody')}</p>
        </div>
      </div>
    );
  }

  const disabledReason = !thread
    ? null
    : thread.blocked_by_me
    ? t('blockedByMe')
    : thread.blocked_by_them
    ? t('blockedByThem')
    : null;

  return (
    <div className="max-w-6xl h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 md:grid-cols-[20rem_1fr] h-full rounded-xl overflow-hidden border border-slate-200 bg-white">
        <div className="hidden md:block">
          <MessageInbox
            items={inbox?.items ?? []}
            filter={filter}
            onFilterChange={setFilter}
            activeThreadId={threadId}
          />
        </div>

        <div className="flex flex-col h-full">
          {loadingThread || !thread ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <ThreadHeader
                other={thread.other_family}
                notificationsMuted={thread.notifications_muted}
                onToggleMute={toggleMute}
                onBlock={() => setBlockOpen(true)}
                onReport={() => setReportOpen(true)}
                onDelete={deleteThread}
              />
              <MessageList
                messages={thread.messages}
                myFamilyId={myFamilyId}
              />
              <Composer
                disabled={!thread.can_send}
                disabledReason={disabledReason}
                onSend={send}
              />
            </>
          )}
        </div>
      </div>

      {thread && (
        <>
          <BlockConfirmDialog
            open={blockOpen}
            onClose={() => setBlockOpen(false)}
            familyId={thread.other_family.id}
            familyName={thread.other_family.family_name}
            onBlocked={() => {
              setThread((cur) =>
                cur
                  ? { ...cur, blocked_by_me: true, can_send: false }
                  : cur,
              );
            }}
          />
          <ReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            threadId={threadId}
            onSubmitted={() => {
              fetchThread();
            }}
          />
        </>
      )}
    </div>
  );
}
