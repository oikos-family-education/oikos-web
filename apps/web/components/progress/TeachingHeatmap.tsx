'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface HeatmapCell {
  date: string;
  count: number;
}

interface TeachingHeatmapProps {
  cells: HeatmapCell[];
  from: string;
  to: string;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function intensityClass(count: number): string {
  if (count <= 0) return 'bg-slate-100';
  if (count === 1) return 'bg-primary/30';
  if (count === 2) return 'bg-primary/60';
  return 'bg-primary';
}

export function TeachingHeatmap({ cells, from, to }: TeachingHeatmapProps) {
  const t = useTranslations('Progress');

  const { weeks, countMap } = useMemo(() => {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    const countMap = new Map<string, number>();
    for (const c of cells) countMap.set(c.date, c.count);

    // Align to Monday.
    const start = new Date(fromDate);
    const startDow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);

    const end = new Date(toDate);
    const endDow = (end.getDay() + 6) % 7;
    end.setDate(end.getDate() + (6 - endDow));

    const weeks: Date[][] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, countMap };
  }, [cells, from, to]);

  if (cells.length === 0) {
    return <p className="text-sm text-slate-500">{t('noHeatmap')}</p>;
  }

  const fromTs = parseDate(from).getTime();
  const toTs = parseDate(to).getTime();

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const key = formatDateKey(day);
                const count = countMap.get(key) ?? 0;
                const ts = day.getTime();
                const inRange = ts >= fromTs && ts <= toTs;
                const cls = inRange
                  ? intensityClass(count)
                  : 'bg-transparent border border-slate-100';
                const label = inRange
                  ? `${day.toDateString()} — ${count} ${count === 1 ? 'entry' : 'entries'}`
                  : day.toDateString();
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    title={label}
                    className={`w-3 h-3 rounded-sm ${cls} hover:ring-2 hover:ring-primary/30`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
