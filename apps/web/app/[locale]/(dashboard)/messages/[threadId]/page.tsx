'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import type {
  InboxFilter,
  InboxPage,
  MessageItemRead,
  ThreadDetail,
} from '../../../../../components/messages/types';

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
        setThread(data);
        // Mark read.
        await apiFetch(`/api/v1/messages/threads/${threadId}/read`, { method: 'POST' });
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
    fetchThread();
  }, [fetchThread]);

  useEffect(() => {
    fetchInbox(filter);
  }, [filter, fetchInbox]);

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
      setThread((cur) =>
        cur ? { ...cur, messages: [...cur.messages, msg] } : cur,
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
                myFamilyId={family?.id ?? null}
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
