'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  RoutineEntryData,
  SubjectData,
  ChildData,
  DAY_NAMES,
  minuteToTime,
  isCustomActivity,
  parseCustomNotes,
} from './types';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface PrintablePlannerProps {
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  templateName?: string;
  familyName?: string;
  shieldConfig?: ShieldConfig | null;
}

interface Window {
  key: string;
  titleKey: string;
  dayIndices: number[];
  startHour: number;
  endHour: number;
  rowHeightPx: number;
}

const WINDOWS: Window[] = [
  { key: 'w1', titleKey: 'printMorning', dayIndices: [0, 1, 2, 3, 4], startHour: 6, endHour: 13, rowHeightPx: 70 },
  { key: 'w2', titleKey: 'printAfternoon', dayIndices: [0, 1, 2, 3, 4], startHour: 13, endHour: 18, rowHeightPx: 95 },
  { key: 'w3', titleKey: 'printEvening', dayIndices: [0, 1, 2, 3, 4], startHour: 18, endHour: 22, rowHeightPx: 110 },
  { key: 'w4', titleKey: 'printWeekend', dayIndices: [5, 6], startHour: 6, endHour: 22, rowHeightPx: 30 },
];

export function PrintablePlanner({ entries, subjects, childrenList, templateName, familyName, shieldConfig }: PrintablePlannerProps) {
  const t = useTranslations('WeekPlanner');

  const pages = WINDOWS.map(w => {
    const windowStartMin = w.startHour * 60;
    const windowEndMin = w.endHour * 60;
    const windowEntries = entries.filter(e =>
      w.dayIndices.includes(e.day_of_week) &&
      e.start_minute < windowEndMin &&
      e.start_minute + e.duration_minutes > windowStartMin
    );
    if (windowEntries.length === 0) return null;
    return { window: w, entries: windowEntries };
  }).filter(Boolean) as { window: Window; entries: RoutineEntryData[] }[];

  if (pages.length === 0) {
    return (
      <div style={{ padding: '20mm', fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t('title')}</h2>
        <p style={{ marginTop: 8 }}>{t('printEmpty')}</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1e293b' }}>
      {pages.map((p, idx) => (
        <PrintPage
          key={p.window.key}
          window={p.window}
          entries={p.entries}
          subjects={subjects}
          childrenList={childrenList}
          title={t(p.window.titleKey)}
          templateName={templateName}
          familyName={familyName}
          shieldConfig={shieldConfig}
          t={t}
          isLast={idx === pages.length - 1}
        />
      ))}
    </div>
  );
}

interface PrintPageProps {
  window: Window;
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  title: string;
  templateName?: string;
  familyName?: string;
  shieldConfig?: ShieldConfig | null;
  t: ReturnType<typeof useTranslations>;
  isLast: boolean;
}

function PrintPage({ window, entries, subjects, childrenList, title, templateName, familyName, shieldConfig, t, isLast }: PrintPageProps) {
  const { dayIndices, startHour, endHour, rowHeightPx } = window;
  const hourCount = endHour - startHour;
  const gridHeight = hourCount * rowHeightPx;

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  function resolveName(e: RoutineEntryData): string {
    if (e.is_free_time) return e.notes?.split('\n')[0] || t('freeTime');
    if (isCustomActivity(e)) return parseCustomNotes(e.notes).name;
    return subjects.find(s => s.id === e.subject_id)?.name || '';
  }

  return (
    <div
      className="print-page"
      style={{
        pageBreakAfter: isLast ? 'auto' : 'always',
        breakAfter: isLast ? 'auto' : 'page',
        padding: '4mm 2mm',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <BookOpen style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Oikos</span>
          <span style={{ color: '#cbd5e1', fontSize: 14 }}>·</span>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#334155' }}>
            {templateName ? `${templateName} — ` : ''}{title}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>
            {String(startHour).padStart(2, '0')}:00 – {String(endHour).padStart(2, '0')}:00
          </span>
          {shieldConfig && familyName && (
            <ShieldPreview
              config={shieldConfig}
              familyName={familyName}
              showMotto={false}
              width={40}
              height={48}
            />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        {/* Time axis */}
        <div style={{ width: 52, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ height: 28, borderBottom: '1px solid #e2e8f0' }} />
          <div style={{ position: 'relative', height: gridHeight }}>
            {hours.slice(0, -1).map((h, i) => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: i * rowHeightPx,
                  left: 0,
                  right: 0,
                  height: rowHeightPx,
                  borderBottom: i === hours.length - 2 ? 'none' : '1px solid #e2e8f0',
                  fontSize: 10,
                  color: '#64748b',
                  padding: '2px 6px',
                }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                fontSize: 10,
                color: '#64748b',
                padding: '0 6px 2px',
                textAlign: 'left',
              }}
            >
              {String(endHour).padStart(2, '0')}:00
            </div>
          </div>
        </div>

        {/* Day columns */}
        {dayIndices.map((dayIdx, colIdx) => {
          const dayEntries = entries.filter(e => e.day_of_week === dayIdx);
          return (
            <div
              key={dayIdx}
              style={{
                flex: 1,
                minWidth: 0,
                borderLeft: colIdx === 0 ? 'none' : '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  height: 28,
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#334155',
                  background: '#f8fafc',
                }}
              >
                {t(DAY_NAMES[dayIdx])}
              </div>
              <div style={{ position: 'relative', height: gridHeight }}>
                {/* Hour grid lines */}
                {hours.slice(0, -1).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: (i + 1) * rowHeightPx,
                      left: 0,
                      right: 0,
                      borderTop: '1px solid #f1f5f9',
                    }}
                  />
                ))}

                {/* Entries */}
                {dayEntries.map(entry => {
                  const entryStart = Math.max(entry.start_minute, startHour * 60);
                  const entryEnd = Math.min(entry.start_minute + entry.duration_minutes, endHour * 60);
                  const topPx = ((entryStart - startHour * 60) / 60) * rowHeightPx;
                  const heightPx = Math.max(((entryEnd - entryStart) / 60) * rowHeightPx, 16);

                  // Overlap handling — slot this entry among concurrent entries in the same day
                  const overlapping = dayEntries.filter(e => {
                    if (e.id === entry.id) return false;
                    const eEnd = e.start_minute + e.duration_minutes;
                    const entryEndFull = entry.start_minute + entry.duration_minutes;
                    return entry.start_minute < eEnd && entryEndFull > e.start_minute;
                  });
                  const all = [entry, ...overlapping]
                    .map(e => ({ id: e.id, name: resolveName(e) }))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(x => x.id);
                  const slotIndex = all.indexOf(entry.id);
                  const totalSlots = all.length;
                  const widthPercent = 100 / totalSlots;
                  const leftPercent = slotIndex * widthPercent;

                  const subject = entry.subject_id ? subjects.find(s => s.id === entry.subject_id) || null : null;
                  const color = entry.color || subject?.color || '#6366F1';
                  const name = resolveName(entry);
                  const childNames = childrenList
                    .filter(c => entry.child_ids.includes(c.id))
                    .map(c => c.nickname || c.name)
                    .join(', ');

                  return (
                    <div
                      key={entry.id}
                      style={{
                        position: 'absolute',
                        top: topPx,
                        height: heightPx,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        background: entry.is_free_time ? '#f0fdf4' : `${color}20`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 3,
                        padding: '2px 4px',
                        fontSize: 9,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        color: '#1e293b',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </div>
                      {heightPx >= 28 && (
                        <div style={{ color: '#475569' }}>
                          {minuteToTime(entry.start_minute)}–{minuteToTime(entry.start_minute + entry.duration_minutes)}
                        </div>
                      )}
                      {heightPx >= 42 && childNames && (
                        <div style={{ color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {childNames}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
