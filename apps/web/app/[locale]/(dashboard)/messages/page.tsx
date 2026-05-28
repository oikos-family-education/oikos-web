'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../../lib/apiFetch';
import { MessageInbox } from '../../../../components/messages/MessageInbox';
import type { InboxFilter, InboxPage } from '../../../../components/messages/types';

export default function MessagesInboxPage() {
  const t = useTranslations('Messages');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [data, setData] = useState<InboxPage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async (f: InboxFilter) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/messages/threads?filter=${f}`);
      if (res.ok) {
        const json: InboxPage = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox(filter);
  }, [filter, fetchInbox]);

  return (
    <div className="max-w-6xl h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 md:grid-cols-[20rem_1fr] h-full rounded-xl overflow-hidden border border-slate-200 bg-white">
        <MessageInbox
          items={data?.items ?? []}
          filter={filter}
          onFilterChange={setFilter}
          loading={loading}
        />
        <div className="hidden md:flex items-center justify-center text-sm text-slate-400 p-8 text-center">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : (
            t('pickAConversation')
          )}
        </div>
      </div>
    </div>
  );
}
