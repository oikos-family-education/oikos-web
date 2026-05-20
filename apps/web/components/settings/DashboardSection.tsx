'use client';

import { apiFetch } from '../../lib/apiFetch';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UiPreferences } from './AppearanceSection';

const LS_KEY = 'oikos:ui-prefs';
const MIN_DAYS = 1;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 14;

function persistLocally(prefs: UiPreferences) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* localStorage unavailable */
  }
}

interface Props {
  initial: UiPreferences;
}

export function DashboardSection({ initial }: Props) {
  const t = useTranslations('Settings');
  const [days, setDays] = useState<number>(() => {
    const v = initial.neglected_threshold_days;
    return typeof v === 'number' && v >= MIN_DAYS && v <= MAX_DAYS ? v : DEFAULT_DAYS;
  });
  const [draft, setDraft] = useState<string>(String(days));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function commit(nextValue: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ui_preferences: { neglected_threshold_days: nextValue },
        }),
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      setDays(nextValue);
      persistLocally({ ...initial, neglected_threshold_days: nextValue });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed < MIN_DAYS || parsed > MAX_DAYS) {
      // Reject — revert to last known good
      setDraft(String(days));
      setError(t('neglectedThresholdRangeError', { min: MIN_DAYS, max: MAX_DAYS }));
      return;
    }
    setError(null);
    if (parsed === days) return;
    commit(parsed);
  }

  function setPreset(value: number) {
    setError(null);
    setDraft(String(value));
    if (value === days) return;
    commit(value);
  }

  const presets = [7, 14, 21, 30];

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">
        {t('dashboardTitle')}
      </h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">
        {t('dashboardSubtitle')}
      </p>

      <div className="space-y-3 max-w-md">
        <label
          htmlFor="neglected-threshold-input"
          className="block text-sm font-semibold text-slate-700"
        >
          {t('neglectedThresholdLabel')}
        </label>
        <p className="text-xs text-slate-500 -mt-2">
          {t('neglectedThresholdDescription')}
        </p>

        <div className="flex items-center gap-2">
          <input
            id="neglected-threshold-input"
            type="number"
            min={MIN_DAYS}
            max={MAX_DAYS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            disabled={saving}
            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            aria-describedby="neglected-threshold-help"
          />
          <span className="text-sm text-slate-600">{t('neglectedThresholdUnit')}</span>
          {savedFlash && (
            <span className="text-xs text-success ml-2" role="status">
              {t('changesSaved')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {presets.map((p) => {
            const selected = p === days;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                disabled={saving}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t('neglectedThresholdPreset', { days: p })}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-xs font-medium text-red-500" role="alert">
            {error}
          </p>
        )}

        <p id="neglected-threshold-help" className="text-xs text-slate-400 pt-1">
          {t('neglectedThresholdHelp')}
        </p>
      </div>
    </section>
  );
}
