'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { useRouter } from '../../lib/navigation';
import { apiFetch } from '../../lib/apiFetch';
import type { NotificationItem } from './types';

const POLL_INTERVAL_MS = 60_000;

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Bell + unread badge + dropdown panel (v2 spec §6.3).
 * Polls the cheap unread-count endpoint every 60s; opens the dropdown on click
 * and fetches the full list once. Marks items read on click + navigates.
 */
export function NotificationBell() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnread(data.count);
      }
    } catch {
      /* swallow */
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCount]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function openDropdown() {
    setOpen(true);
    if (items !== null) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/notifications?limit=25');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setUnread(data.unread_count);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await apiFetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
    setItems((cur) => cur ? cur.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })) : cur);
    setUnread(0);
  }

  async function openItem(item: NotificationItem) {
    if (!item.read_at) {
      try {
        await apiFetch(`/api/v1/notifications/${item.id}/read`, { method: 'POST' });
      } catch { /* non-fatal */ }
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (item.community_slug && item.topic_id) {
      const url = item.reply_id
        ? `/community/${item.community_slug}/forum/${item.topic_id}#reply-${item.reply_id}`
        : `/community/${item.community_slug}/forum/${item.topic_id}`;
      router.push(url);
    }
  }

  function describe(item: NotificationItem): string {
    const actor = item.actor_family_name || 'A family';
    if (item.event_type === 'topic_created') {
      return t('topicCreated', { actor, community: item.community_name || 'community' });
    }
    return t('replyCreated', { actor, topic: item.topic_title || 'topic' });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        aria-label={t('bellTitle')}
        title={t('bellTitle')}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">{t('bellTitle')}</h3>
            {items && items.some((i) => !i.read_at) && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:text-primary-hover"
              >
                {t('markAllRead')}
              </button>
            )}
          </header>
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">…</div>
          )}
          {items && items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t('empty')}</div>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col gap-1 ${
                      !item.read_at ? 'bg-primary/5' : ''
                    }`}
                  >
                    <p className="text-sm text-slate-700 line-clamp-2">{describe(item)}</p>
                    <p className="text-xs text-slate-400">{relativeTime(item.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
