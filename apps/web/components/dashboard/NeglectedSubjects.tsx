'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';

interface NeglectedSubject {
  subject_id: string;
  subject_name: string;
  color: string | null;
  days_since_last_log: number | null;
  last_taught_on: string | null;
  assigned_child_names: string[];
}

const MAX_VISIBLE = 5;

export function NeglectedSubjects() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<NeglectedSubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/v1/progress/neglected', { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        return;
      }
      setItems(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <WidgetCard title={t('neglectedTitle')}>
      {loading && <WidgetSkeleton rows={3} />}
      {!loading && error && <WidgetError onRetry={load} />}
      {!loading && !error && items && items.length === 0 && (
        <WidgetEmpty
          icon={<CheckCircle2 className="h-7 w-7 text-success" />}
          title={t('neglectedNone')}
        />
      )}
      {!loading && !error && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.slice(0, MAX_VISIBLE).map((s) => {
            const days = s.days_since_last_log;
            // 14-20 days: amber. >20 OR never taught: red.
            const severe = days === null || days > 20;
            const tone = severe
              ? 'text-red-500 bg-red-50 border-red-100'
              : 'text-amber-600 bg-amber-50 border-amber-100';
            const label = days === null ? 'never logged' : t('neglectedDaysAgo', { days });
            return (
              <li key={s.subject_id}>
                <Link
                  href={`/subjects/${s.subject_id}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 hover:opacity-90 transition-opacity ${tone}`}
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.subject_name}</p>
                    {s.assigned_child_names.length > 0 && (
                      <p className="text-[10px] opacity-80 truncate">
                        {s.assigned_child_names.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
                </Link>
              </li>
            );
          })}
          {items.length > MAX_VISIBLE && (
            <li>
              <Link
                href="/progress"
                className="block text-center text-xs font-medium text-slate-500 hover:text-primary py-1"
              >
                {t('neglectedShowMore', { count: items.length - MAX_VISIBLE })} →
              </Link>
            </li>
          )}
        </ul>
      )}
    </WidgetCard>
  );
}
