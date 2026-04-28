'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { Award } from 'lucide-react';
import { WidgetCard, WidgetSkeleton } from './WidgetCard';

interface RecentAchievement {
  achievement_id: string;
  child_id: string;
  child_name: string;
  project_id: string;
  project_title: string;
  completed_at: string;
  certificate_number: string;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export function RecentCertificates() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<RecentAchievement[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/projects/achievements?limit=10', {
          credentials: 'include',
        });
        if (!res.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely when there are no achievements (per spec).
  if (!loading && items !== null && items.length === 0) return null;

  return (
    <WidgetCard title={t('certificatesTitle')}>
      {loading && <WidgetSkeleton rows={1} />}
      {!loading && items && items.length > 0 && (
        <ul
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
          aria-label={t('certificatesTitle')}
        >
          {items.map((a) => (
            <li
              key={a.achievement_id}
              className="snap-start flex-shrink-0 min-w-[180px] max-w-[200px]"
            >
              <Link
                href={`/projects/${a.project_id}`}
                className="group block h-full rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 hover:shadow-md hover:border-amber-300 transition-all"
              >
                <Award className="h-7 w-7 text-amber-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 truncate">{a.child_name}</p>
                <p className="text-xs text-slate-700 mt-1 line-clamp-2 min-h-[32px]">
                  {a.project_title}
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  {t('certificatesCompleted', { date: formatDate(a.completed_at) })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
