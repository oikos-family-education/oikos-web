'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../lib/navigation';
import { LogTab } from './LogTab';
import { StreaksTab } from './StreaksTab';
import { ReportTab } from './ReportTab';
import { useProgressSummary } from '../../hooks/useProgressSummary';

interface ChildMeta {
  id: string;
  first_name: string;
  nickname: string | null;
}

interface SubjectMeta {
  id: string;
  name: string;
  color: string;
}

type TabKey = 'log' | 'streaks' | 'report';
type RangePreset = 'last30' | 'last90' | 'thisTerm' | 'thisYear' | 'custom';

interface StoredRange {
  preset: RangePreset;
  from: string;
  to: string;
}

const STORAGE_KEY = 'progress.range';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computePreset(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  const to = isoDate(today);

  if (preset === 'last30') {
    const f = new Date(today);
    f.setDate(f.getDate() - 29);
    return { from: isoDate(f), to };
  }
  if (preset === 'last90') {
    const f = new Date(today);
    f.setDate(f.getDate() - 89);
    return { from: isoDate(f), to };
  }
  if (preset === 'thisYear') {
    return { from: `${today.getFullYear()}-01-01`, to };
  }
  // thisTerm: current 6-month window (Aug–Jan or Feb–Jul)
  const month = today.getMonth(); // 0..11
  const termStart = month >= 7 ? new Date(today.getFullYear(), 7, 1) : new Date(today.getFullYear(), 1, 1);
  return { from: isoDate(termStart), to };
}

function loadStoredRange(): StoredRange {
  if (typeof window === 'undefined') {
    const r = computePreset('last30');
    return { preset: 'last30', ...r };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredRange;
      if (parsed.preset && parsed.from && parsed.to) return parsed;
    }
  } catch {
    /* ignore */
  }
  const r = computePreset('last30');
  return { preset: 'last30', ...r };
}

export function ProgressPage() {
  const t = useTranslations('Progress');
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('log');
  const [range, setRange] = useState<StoredRange>(() => loadStoredRange());
  const [children, setChildren] = useState<ChildMeta[]>([]);
  const [subjects, setSubjects] = useState<SubjectMeta[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    } catch {
      /* ignore */
    }
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [childRes, subjRes] = await Promise.all([
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
      ]);
      if (cancelled) return;
      if (childRes.ok) setChildren(await childRes.json());
      if (subjRes.ok) setSubjects(await subjRes.json());
      setMetaLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: summary, isLoading: summaryLoading, refetch } = useProgressSummary(
    range.from,
    range.to,
  );

  const onLogChanged = useCallback(() => {
    refetch();
  }, [refetch]);

  function onPresetChange(preset: RangePreset) {
    if (preset === 'custom') {
      setRange({ preset, from: range.from, to: range.to });
      return;
    }
    const r = computePreset(preset);
    setRange({ preset, ...r });
  }

  function onPrintReport() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    router.push(`/progress/report?${params.toString()}`);
  }

  const tabs = useMemo<{ key: TabKey; label: string }[]>(
    () => [
      { key: 'log', label: t('tabLog') },
      { key: 'streaks', label: t('tabStreaks') },
      { key: 'report', label: t('tabReport') },
    ],
    [t],
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex p-3 rounded-2xl bg-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
            <p className="text-slate-500 mt-1 text-sm">{t('subtitle')}</p>
          </div>
        </div>
        <button
          onClick={onPrintReport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          {t('printReport')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700" htmlFor="range-preset">
          {t('tabReport')}:
        </label>
        <select
          id="range-preset"
          value={range.preset}
          onChange={(e) => onPresetChange(e.target.value as RangePreset)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="last30">{t('rangeLast30')}</option>
          <option value="last90">{t('rangeLast90')}</option>
          <option value="thisTerm">{t('rangeThisTerm')}</option>
          <option value="thisYear">{t('rangeThisYear')}</option>
          <option value="custom">{t('rangeCustom')}</option>
        </select>

        {range.preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        )}

        {range.preset !== 'custom' && (
          <span className="text-xs text-slate-500">
            {range.from} → {range.to}
          </span>
        )}
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6" role="tablist">
          {tabs.map((tt) => {
            const active = tab === tt.key;
            return (
              <button
                key={tt.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tt.key)}
                className={`pb-3 -mb-px text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tt.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'log' && (
        metaLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <LogTab childrenList={children} subjects={subjects} onChanged={onLogChanged} />
        )
      )}

      {tab === 'streaks' && (
        summaryLoading || !summary ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <StreaksTab summary={summary} />
        )
      )}

      {tab === 'report' && <ReportTab from={range.from} to={range.to} />}
    </div>
  );
}
