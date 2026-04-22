'use client';

import React, { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';
import type { ProgressReport } from '../../hooks/useProgressReport';

interface PrintableReportProps {
  report: ProgressReport;
}

function formatLongDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatLongDateFromIso(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function periodLabel(t: (k: string) => string, periodType: string): string {
  const map: Record<string, string> = {
    semester: t('reportPeriodSemester'),
    monthly: t('reportPeriodMonthly'),
    quarterly: t('reportPeriodQuarterly'),
    annual: t('reportPeriodAnnual'),
    custom: t('reportPeriodCustom'),
  };
  return map[periodType] ?? periodType;
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  function PrintableReport({ report }, ref) {
    const t = useTranslations('Progress');

    const fromLabel = formatLongDate(report.range.from);
    const toLabel = formatLongDate(report.range.to);
    const generatedLabel = formatLongDateFromIso(report.generated_at);

    const { teach_counts, family, children, curricula, projects } = report;
    const pct = teach_counts.range_days > 0
      ? Math.round((teach_counts.days_with_any_log / teach_counts.range_days) * 100)
      : 0;

    const childMap = new Map(children.map((c) => [c.id, c]));

    return (
      <div
        ref={ref}
        className="progress-report-sheet bg-white w-full max-w-[210mm] mx-auto p-10 shadow-sm text-slate-800"
        style={{ fontFamily: "'Palatino Linotype', 'Palatino', 'Georgia', 'Times New Roman', serif" }}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight text-slate-800">Oikos</span>
            <span className="text-xs text-slate-500 tracking-widest uppercase mt-1">
              Family Education Platform
            </span>
          </div>
          <div className="flex flex-col items-center">
            {family.shield_config && Object.keys(family.shield_config).length > 0 ? (
              <ShieldPreview
                config={family.shield_config as unknown as ShieldConfig}
                familyName={family.family_name}
                showMotto={true}
                width={110}
                height={130}
              />
            ) : (
              <div
                className="border border-slate-200 rounded-md flex items-center justify-center text-slate-300 text-xs"
                style={{ width: 110, height: 130 }}
              >
                no shield
              </div>
            )}
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">{t('reportTitle')}</h1>
          <p className="text-slate-600 mt-2">{family.family_name}</p>
          <p className="text-slate-500 text-sm">
            {fromLabel} — {toLabel}
          </p>
          {family.location && (
            <p className="text-slate-400 text-xs mt-1">{family.location}</p>
          )}
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 pb-1 mb-3 border-b border-slate-200">
            {t('reportChildren')}
          </h2>
          {children.length === 0 ? (
            <p className="text-slate-500 italic text-sm">—</p>
          ) : (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id} className="text-slate-700">
                  <span className="font-medium">{c.first_name}</span>
                  {c.grade_level && (
                    <span className="text-slate-500 ml-2">
                      ({t('reportGrade', { grade: c.grade_level })})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 pb-1 mb-3 border-b border-slate-200">
            {t('reportTeachingSummary')}
          </h2>
          <ul className="space-y-1 text-slate-700 mb-4">
            <li>
              {t('reportDaysTaught', {
                taught: teach_counts.days_with_any_log,
                total: teach_counts.range_days,
                percent: pct,
              })}
            </li>
            <li>{t('reportTotalEntries', { count: teach_counts.total_entries })}</li>
          </ul>

          {teach_counts.by_child.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                {t('reportPerChild')}
              </h3>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {teach_counts.by_child.map((row, idx) => (
                    <tr key={row.child_id} className={idx % 2 ? 'bg-slate-50' : ''}>
                      <td className="py-1 px-2 border border-slate-200">{row.first_name}</td>
                      <td className="py-1 px-2 border border-slate-200 w-24 text-right text-slate-600">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {teach_counts.by_subject.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                {t('reportPerSubject')}
              </h3>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {teach_counts.by_subject.map((row, idx) => (
                    <tr key={row.subject_id} className={idx % 2 ? 'bg-slate-50' : ''}>
                      <td className="py-1 px-2 border border-slate-200">{row.name}</td>
                      <td className="py-1 px-2 border border-slate-200 w-24 text-right text-slate-600">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 pb-1 mb-3 border-b border-slate-200">
            {t('reportCurricula')}
          </h2>
          {curricula.length === 0 ? (
            <p className="text-slate-500 italic text-sm">{t('reportNoCurricula')}</p>
          ) : (
            <div className="space-y-4">
              {curricula.map((cur) => (
                <div key={cur.id}>
                  <p className="text-slate-800 font-medium">
                    {cur.name}{' '}
                    <span className="text-slate-500 text-sm font-normal">
                      ({periodLabel(t, cur.period_type)}, {cur.start_date} → {cur.end_date}, {cur.status})
                    </span>
                  </p>
                  {cur.subjects.length > 0 && (
                    <ul className="mt-1 ml-4 list-disc text-sm text-slate-700">
                      {cur.subjects.map((s) => (
                        <li key={s.subject_id}>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-slate-500">
                            {' '}
                            — {t('reportSubjectFrequency', { count: s.weekly_frequency })}
                          </span>
                          {s.goals_for_period.length > 0 && (
                            <span className="text-slate-500 italic">
                              {' '}
                              — {t('reportGoals', { goals: s.goals_for_period.join('; ') })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 pb-1 mb-3 border-b border-slate-200">
            {t('reportProjects')}
          </h2>
          {projects.length === 0 ? (
            <p className="text-slate-500 italic text-sm">{t('reportNoProjects')}</p>
          ) : (
            <div className="space-y-4">
              {projects.map((p) => {
                const childNames = p.child_ids
                  .map((cid) => childMap.get(cid)?.first_name)
                  .filter(Boolean);
                return (
                  <div key={p.id}>
                    <p className="text-slate-800 font-medium">
                      {p.title}
                      {childNames.length > 0 && (
                        <span className="text-slate-500 font-normal"> ({childNames.join(', ')})</span>
                      )}
                      {p.due_date && (
                        <span className="text-slate-500 text-sm font-normal">
                          {' '}
                          — {t('reportDueOn', { date: p.due_date })}
                        </span>
                      )}
                    </p>
                    {p.milestones.length > 0 && (
                      <ul className="mt-1 ml-4 text-sm text-slate-700 space-y-0.5">
                        {p.milestones.map((m) => {
                          const done = m.completions.length > 0;
                          return (
                            <li key={m.id}>
                              <span className="mr-2">{done ? '✓' : '☐'}</span>
                              <span className={done ? '' : 'text-slate-500'}>{m.title}</span>
                              {done && m.completions[0]?.completed_at && (
                                <span className="text-slate-400 text-xs ml-2">
                                  — {m.completions[0].completed_at.slice(0, 10)}
                                </span>
                              )}
                              {!done && m.due_date && (
                                <span className="text-slate-400 text-xs ml-2">
                                  — {t('reportDueOn', { date: m.due_date })}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="pt-4 mt-8 border-t border-slate-200 text-center text-xs text-slate-500">
          {t('reportGeneratedOn', { date: generatedLabel })}
        </div>
      </div>
    );
  },
);
