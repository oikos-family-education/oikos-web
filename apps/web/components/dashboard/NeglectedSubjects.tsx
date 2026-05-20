'use client';

import { apiFetch } from '../../lib/apiFetch';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';
import { Modal } from './Modal';

interface NeglectedSubject {
  subject_id: string;
  subject_name: string;
  color: string | null;
  days_since_last_log: number | null;
  last_taught_on: string | null;
  assigned_child_names: string[];
}

const MAX_VISIBLE = 5;
const DEFAULT_THRESHOLD_DAYS = 14;
const LS_KEY = 'oikos:ui-prefs';

/**
 * Reads the user's preferred "days before neglected" from localStorage. Mirrors
 * the value the Settings page persists to the DB; falls back to 14 if missing
 * or malformed.
 */
function readThresholdDays(): number {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLD_DAYS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_THRESHOLD_DAYS;
    const parsed = JSON.parse(raw);
    const v = parsed?.neglected_threshold_days;
    if (typeof v === 'number' && v >= 1 && v <= 365) return v;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_THRESHOLD_DAYS;
}

export function NeglectedSubjects() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<NeglectedSubject[] | null>(null);
  const [thresholdDays, setThresholdDays] = useState<number>(DEFAULT_THRESHOLD_DAYS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch(
        `/api/v1/progress/neglected?threshold_days=${days}`,
        { credentials: 'include' },
      );
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
    const days = readThresholdDays();
    setThresholdDays(days);
    load(days);
  }, [load]);

  const headerActions = (
    <button
      type="button"
      onClick={() => setHelpOpen(true)}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      {t('neglectedHelpLabel')}
    </button>
  );

  return (
    <>
      <WidgetCard title={t('neglectedTitle')} actions={headerActions}>
        {loading && <WidgetSkeleton rows={3} />}
        {!loading && error && <WidgetError onRetry={() => load(thresholdDays)} />}
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
              // Severity rule: never-taught or >20 days = red; otherwise amber.
              const severe = days === null || days > 20;
              const tone = severe
                ? 'text-red-500 bg-red-50 border-red-100'
                : 'text-amber-600 bg-amber-50 border-amber-100';
              const label =
                days === null ? t('neglectedNeverLogged') : t('neglectedDaysAgo', { days });
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

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('neglectedHelpTitle')}
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>{t('neglectedHelpIntro')}</p>

          <div>
            <p className="font-semibold text-slate-800 mb-1">
              {t('neglectedHelpHowHeading')}
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>
                {t.rich('neglectedHelpRuleThreshold', {
                  days: thresholdDays,
                  strong: (chunks) => (
                    <strong className="font-semibold text-slate-800">{chunks}</strong>
                  ),
                })}
              </li>
              <li>{t('neglectedHelpRuleScope')}</li>
              <li>{t('neglectedHelpRuleSeverity')}</li>
              <li>{t('neglectedHelpRuleNever')}</li>
            </ul>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600">
              {t.rich('neglectedHelpChangeThreshold', {
                settingsLink: (chunks) => (
                  <Link
                    href="/settings"
                    className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
                    onClick={() => setHelpOpen(false)}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
