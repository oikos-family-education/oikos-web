'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Globe as GlobeIcon } from 'lucide-react';
import { Link } from '../../lib/navigation';
import { apiFetch } from '../../lib/apiFetch';
import { findEmblem, DEFAULT_PRIMARY } from '../../lib/communityEmblems';
import { WidgetCard } from './WidgetCard';
import type { DashboardCommunityRow } from '../community/types';

const POLL_INTERVAL_MS = 90_000;

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const m = Math.max(1, Math.floor((now - t) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Dashboard widget listing the family's communities with unread badges and the
 * latest forum activity. v2 spec §9.
 */
export function DashboardCommunities() {
  const t = useTranslations('DashboardCommunities');
  const [rows, setRows] = useState<DashboardCommunityRow[] | null>(null);

  async function load() {
    try {
      const res = await apiFetch('/api/v1/communities/dashboard-summary');
      if (res.ok) setRows(await res.json());
      else setRows([]);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (rows === null) return null; // never render skeleton — silent until first response

  return (
    <WidgetCard
      title={t('title')}
      testId="dashboard-communities-widget"
      actions={
        <Link href="/community" className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          {t('viewAll')} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-500 mb-3">{t('empty')}</p>
          <Link href="/community" className="text-sm text-primary hover:text-primary-hover">
            {t('joinACommunity')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const identity = row.community.identity;
            const primary = identity?.primary_color || DEFAULT_PRIMARY;
            const Emblem = findEmblem(identity?.emblem)?.Icon;
            return (
              <li key={row.community.id}>
                <Link
                  href={`/community/${row.community.slug}/forum`}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${primary}1A` /* 10% */ }}
                  >
                    {Emblem ? (
                      <Emblem className="w-5 h-5" style={{ color: primary }} />
                    ) : (
                      <GlobeIcon className="w-5 h-5" style={{ color: primary }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{row.community.name}</h4>
                      {row.unread_count > 0 && (
                        <span
                          aria-label={t('unreadLabel', { count: row.unread_count })}
                          className="shrink-0 text-[10px] font-semibold px-1.5 rounded-full bg-red-500 text-white"
                        >
                          {row.unread_count > 9 ? '9+' : row.unread_count}
                        </span>
                      )}
                    </div>
                    {row.last_activity ? (
                      <p className="text-xs text-slate-500 truncate">
                        {row.last_activity.actor_family_name} · {row.last_activity.topic_title}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">{t('noActivity')}</p>
                    )}
                  </div>
                  {row.last_activity && (
                    <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
                      {relativeTime(row.last_activity.created_at)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
