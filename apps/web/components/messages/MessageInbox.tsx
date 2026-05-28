'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';
import type { ThreadInboxRow, InboxFilter } from './types';

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  items: ThreadInboxRow[];
  filter: InboxFilter;
  onFilterChange: (f: InboxFilter) => void;
  activeThreadId?: string | null;
  loading?: boolean;
}

export function MessageInbox({
  items,
  filter,
  onFilterChange,
  activeThreadId,
  loading,
}: Props) {
  const t = useTranslations('Messages');

  const emptyKey =
    filter === 'unread' ? 'emptyUnread' : filter === 'archived' ? 'emptyArchived' : 'emptyAll';

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-800 mb-3">{t('title')}</h1>
        <div className="flex gap-1">
          {(['all', 'unread', 'archived'] as InboxFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              className={`text-xs px-3 py-1 rounded-full ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t(
                f === 'all'
                  ? 'inboxFilterAll'
                  : f === 'unread'
                  ? 'inboxFilterUnread'
                  : 'inboxFilterArchived',
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            {t('loading')}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            {t(emptyKey)}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {items.map((row) => {
            const hasShield =
              row.other_family.shield_config &&
              (row.other_family.shield_config as unknown as Partial<ShieldConfig>).initials;
            return (
              <li key={row.id}>
                <Link
                  href={`/messages/${row.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${
                    activeThreadId === row.id ? 'bg-primary/5' : ''
                  }`}
                >
                  {hasShield ? (
                    <ShieldPreview
                      config={row.other_family.shield_config as unknown as ShieldConfig}
                      familyName={row.other_family.family_name}
                      showFamilyName={false}
                      width={36}
                      height={44}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-semibold inline-flex items-center justify-center shrink-0">
                      {row.other_family.family_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          row.unread
                            ? 'font-semibold text-slate-800'
                            : 'font-medium text-slate-700'
                        }`}
                      >
                        {row.other_family.family_name}
                      </span>
                      {row.last_message_at && (
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {relativeTime(row.last_message_at)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs truncate ${
                        row.unread ? 'text-slate-700' : 'text-slate-500'
                      }`}
                    >
                      {row.last_message_excerpt || '…'}
                    </p>
                  </div>
                  {row.unread && (
                    <span
                      className="w-2 h-2 rounded-full bg-primary shrink-0"
                      aria-label="unread"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
