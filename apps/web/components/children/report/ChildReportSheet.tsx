'use client';

import React, { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Film, Pin, Sparkles, TreePine, UserRound, Users, icons } from 'lucide-react';
import { PrintableHeader } from '../../ui/PrintableHeader';
import type { ShieldConfig } from '../../onboarding/ShieldBuilder';
import { categoryKey } from '../../../lib/categoryLabel';
import { getChildDisplayName } from '../../../lib/childDisplay';
import { GRADE_LABELS, LEARNING_STYLE_LABELS, computeAge } from '../../../lib/childProfile';
import { formatDate } from '../../../lib/formatDate';
import { getTypeKey } from '../../resources/ResourceCard';
import { DAY_NAMES, DAY_SHORTS, minuteToTime, parseCustomNotes } from '../../planner/types';
import {
  ChildReport,
  HIGHLIGHT_CATEGORIES,
  HighlightCategory,
  ReportRoutineEntry,
  ReportSection,
  ReportSubject,
  parseLocalDate,
} from './types';

export const HIGHLIGHT_ICONS: Record<HighlightCategory, React.ElementType> = {
  social: Users,
  book: BookOpen,
  documentary: Film,
  outdoor: TreePine,
  other: Sparkles,
};

interface ChildReportSheetProps {
  report: ChildReport;
  sections: Set<ReportSection>;
  dateFormat: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-slate-800 pb-1 mb-3 border-b border-slate-200">{children}</h2>
  );
}

function SubjectIcon({ icon, color }: { icon: string | null; color: string }) {
  const Icon = icon && icon in icons ? icons[icon as keyof typeof icons] : BookOpen;
  return (
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}1f` }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
    </span>
  );
}

function routineEntryName(e: ReportRoutineEntry, freeTime: string): string {
  if (e.is_free_time) return (e.notes ?? '').split('\n')[0] || freeTime;
  if (!e.subject_id) return parseCustomNotes(e.notes).name;
  return e.subject_name ?? '';
}

export const ChildReportSheet = forwardRef<HTMLDivElement, ChildReportSheetProps>(
  function ChildReportSheet({ report, sections, dateFormat }, ref) {
    const t = useTranslations('ChildReport');
    const tPlan = useTranslations('WeekPlanner');

    const { child, family, curriculums, projects, routine, notes, highlights, learning_summary } = report;
    const name = getChildDisplayName(child);
    const fullName = child.nickname && child.nickname !== child.first_name
      ? `${child.first_name} (${child.nickname})`
      : child.first_name;
    const age = computeAge(child.birthdate, child.birth_year);
    const grade = child.grade_level ? GRADE_LABELS[child.grade_level] ?? child.grade_level : null;
    const fmt = (d: string) => formatDate(parseLocalDate(d), dateFormat);
    const has = (s: ReportSection) => sections.has(s);

    const routineDays = routine
      ? [0, 1, 2, 3, 4, ...(routine.include_saturday ? [5] : []), ...(routine.include_sunday ? [6] : [])]
          .map((d) => ({ day: d, entries: routine.entries.filter((e) => e.day_of_week === d) }))
          .filter((d) => d.entries.length > 0)
      : [];

    return (
      <div
        ref={ref}
        className="progress-report-sheet bg-white w-full max-w-[210mm] mx-auto p-6 sm:p-10 shadow-sm text-slate-800"
        style={{ fontFamily: "'Palatino Linotype', 'Palatino', 'Georgia', 'Times New Roman', serif" }}
      >
        <div className="mb-6">
          <PrintableHeader
            shieldConfig={
              family.shield_config && Object.keys(family.shield_config).length > 0
                ? (family.shield_config as unknown as ShieldConfig)
                : null
            }
            familyName={family.family_name}
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">{t('sheetTitle', { name })}</h1>
          <p className="text-slate-600 mt-2">{family.family_name}</p>
          <p className="text-slate-500 text-sm">
            {fmt(report.range.from_date)} — {fmt(report.range.to_date)}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            {t('generatedOn', { date: formatDate(new Date(report.generated_at), dateFormat) })}
          </p>
        </div>

        {/* About the child */}
        {(has('profile') || has('support')) && (
          <section className="mb-8">
            <SectionTitle>{t('sectionProfile', { name })}</SectionTitle>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-slate-500">{t('profileName')}</dt><dd className="font-medium">{fullName}</dd></div>
              {age !== null && (
                <div><dt className="text-slate-500">{t('profileAge')}</dt><dd className="font-medium">{t('yearsOld', { age })}</dd></div>
              )}
              {grade && <div><dt className="text-slate-500">{t('profileGrade')}</dt><dd className="font-medium">{grade}</dd></div>}
              {has('profile') && child.learning_styles.length > 0 && (
                <div>
                  <dt className="text-slate-500">{t('profileLearningStyles')}</dt>
                  <dd className="font-medium">{child.learning_styles.map((s) => LEARNING_STYLE_LABELS[s] ?? s).join(', ')}</dd>
                </div>
              )}
              {has('profile') && child.interests.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{t('profileInterests')}</dt>
                  <dd>{child.interests.join(', ')}</dd>
                </div>
              )}
              {has('profile') && (child.personality_description || child.personality_tags.length > 0) && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{t('profilePersonality')}</dt>
                  <dd>
                    {child.personality_tags.length > 0 && <span>{child.personality_tags.join(', ')}. </span>}
                    {child.personality_description}
                  </dd>
                </div>
              )}
              {has('profile') && child.motivators && (
                <div className="sm:col-span-2"><dt className="text-slate-500">{t('profileMotivators')}</dt><dd>{child.motivators}</dd></div>
              )}
              {has('support') && child.learning_differences.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{t('profileLearningDifferences')}</dt>
                  <dd>{child.learning_differences.join(', ')}</dd>
                </div>
              )}
              {has('support') && child.accommodations_notes && (
                <div className="sm:col-span-2"><dt className="text-slate-500">{t('profileAccommodations')}</dt><dd>{child.accommodations_notes}</dd></div>
              )}
            </dl>
          </section>
        )}

        {/* Learning summary */}
        {has('summary') && (
          <section className="mb-8">
            <SectionTitle>{t('sectionSummary')}</SectionTitle>
            <ul className="grid grid-cols-3 gap-3 text-center">
              {[
                { value: learning_summary.total_sessions, label: t('summarySessions') },
                { value: Math.round(learning_summary.total_minutes / 60), label: t('summaryHours') },
                { value: learning_summary.days_with_sessions, label: t('summaryDays') },
              ].map((item) => (
                <li key={item.label} className="border border-slate-200 rounded-lg py-3">
                  <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                  <p className="text-xs text-slate-500">{item.label}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Curriculum */}
        {has('curriculum') && (
          <section className="mb-8">
            <SectionTitle>{t('sectionCurriculum')}</SectionTitle>
            {curriculums.length === 0 ? (
              <p className="text-slate-500 italic text-sm">{t('noCurriculum')}</p>
            ) : (
              <div className="space-y-6">
                {curriculums.map((cur) => (
                  <div key={cur.id}>
                    <p className="font-semibold text-slate-800">{cur.name}</p>
                    <p className="text-sm text-slate-500">
                      {fmt(cur.start_date)} — {fmt(cur.end_date)}
                      {cur.education_philosophy && <> · {cur.education_philosophy}</>}
                    </p>
                    {cur.description && <p className="text-sm text-slate-600 mt-1">{cur.description}</p>}
                    {cur.overall_goals.length > 0 && (
                      <div className="mt-2 text-sm">
                        <p className="font-medium text-slate-700">{t('curriculumGoals')}</p>
                        <ul className="ml-5 list-disc text-slate-600">
                          {cur.overall_goals.map((g) => <li key={g}>{g}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="mt-4 space-y-4">
                      {cur.subjects.map((s) => (
                        <SubjectBlock key={s.id} subject={s} showLogged={has('summary')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Projects */}
        {has('projects') && (
          <section className="mb-8">
            <SectionTitle>{t('sectionProjects')}</SectionTitle>
            {projects.length === 0 ? (
              <p className="text-slate-500 italic text-sm">{t('noProjects')}</p>
            ) : (
              <div className="space-y-4">
                {projects.map((p) => (
                  <div key={p.id} className="text-sm" style={{ breakInside: 'avoid' }}>
                    <p className="font-semibold text-slate-800">
                      {p.title}{' '}
                      <span className="font-normal text-slate-500">
                        ({p.status === 'complete' && p.completed_at
                          ? t('projectCompletedOn', { date: formatDate(new Date(p.completed_at), dateFormat) })
                          : t('projectInProgress')})
                      </span>
                    </p>
                    {p.subject_names.length > 0 && <p className="text-slate-500">{p.subject_names.join(', ')}</p>}
                    {p.description && <p className="text-slate-600 mt-1">{p.description}</p>}
                    {p.purpose && <p className="text-slate-600 mt-1"><span className="font-medium">{t('projectPurpose')}:</span> {p.purpose}</p>}
                    {p.milestones_total > 0 && (
                      <p className="text-slate-600 mt-1">
                        {t('projectMilestones', { done: p.milestones_completed, total: p.milestones_total })}
                      </p>
                    )}
                    {p.portfolio && (
                      <div className="mt-2 pl-3 border-l-2 border-slate-200 text-slate-600">
                        <p className="font-medium text-slate-700">
                          {t('projectPortfolio', { title: p.portfolio.title })}
                          {p.portfolio.score !== null && <> · {t('projectScore', { score: p.portfolio.score })}</>}
                        </p>
                        {p.portfolio.reflection && <p className="mt-0.5">“{p.portfolio.reflection}”</p>}
                        {p.portfolio.parent_notes && <p className="mt-0.5 italic">{p.portfolio.parent_notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Week routine */}
        {has('routine') && (
          <section className="mb-8" style={{ breakInside: 'avoid' }}>
            <SectionTitle>{t('sectionRoutine')}</SectionTitle>
            {routineDays.length === 0 ? (
              <p className="text-slate-500 italic text-sm">{t('noRoutine')}</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2">{routine!.template_name}</p>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {routineDays.map(({ day, entries }, idx) => (
                      <tr key={day} className={idx % 2 ? 'bg-slate-50' : ''}>
                        <th scope="row" className="py-1.5 px-2 border border-slate-200 w-28 text-left font-medium align-top">
                          {tPlan(DAY_NAMES[day])}
                        </th>
                        <td className="py-1.5 px-2 border border-slate-200 text-slate-700">
                          {entries.map((e) => (
                            <span key={`${e.day_of_week}-${e.start_minute}-${e.subject_id ?? e.notes}`} className="inline-flex items-center gap-1 mr-3">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color ?? '#94a3b8' }} />
                              <span className="text-slate-500">{minuteToTime(e.start_minute)}</span>
                              {routineEntryName(e, tPlan('freeTime'))}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}

        {/* Highlights */}
        {has('highlights') && (
          <section className="mb-8">
            <SectionTitle>{t('sectionHighlights')}</SectionTitle>
            {highlights.length === 0 ? (
              <p className="text-slate-500 italic text-sm">{t('noHighlights')}</p>
            ) : (
              <div className="space-y-6">
                {HIGHLIGHT_CATEGORIES.map((cat) => {
                  const items = highlights.filter((h) => h.category === cat);
                  if (items.length === 0) return null;
                  const Icon = HIGHLIGHT_ICONS[cat];
                  return (
                    <div key={cat}>
                      <h3
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"
                        style={{ breakAfter: 'avoid' }}
                      >
                        <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                        </span>
                        {t(`category_${cat}`)}
                        <span className="font-normal text-slate-400">({items.length})</span>
                      </h3>
                      <ul className="divide-y divide-slate-100 border-t border-b border-slate-100 text-sm">
                        {items.map((h) => (
                          <li key={h.id} className="py-3 pl-3 border-l-2 border-slate-200" style={{ breakInside: 'avoid' }}>
                            <div className="flex items-baseline justify-between gap-4">
                              <p className="font-semibold text-slate-800">{h.title}</p>
                              {h.occurred_on && (
                                <p className="text-xs text-slate-500 whitespace-nowrap">{fmt(h.occurred_on)}</p>
                              )}
                            </div>
                            {h.description && (
                              <p className="mt-1.5 pl-4 text-slate-600 leading-relaxed whitespace-pre-line">{h.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Notes */}
        {has('notes') && (
          <section className="mb-2">
            <SectionTitle>{t('sectionNotes')}</SectionTitle>
            {notes.length === 0 ? (
              <p className="text-slate-500 italic text-sm">{t('noNotes')}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {notes.map((n) => (
                  <li key={n.id} style={{ breakInside: 'avoid' }}>
                    <p className="flex items-center gap-1 text-slate-500 text-xs">
                      {n.is_pinned && <Pin className="w-3 h-3" />}
                      {formatDate(new Date(n.created_at), dateFormat)}
                    </p>
                    {n.title && <p className="font-medium text-slate-800">{n.title}</p>}
                    <p className="text-slate-600 whitespace-pre-line">{n.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    );
  },
);

function SubjectBlock({ subject: s, showLogged }: { subject: ReportSubject; showLogged: boolean }) {
  const t = useTranslations('ChildReport');
  const tSubj = useTranslations('Subjects');
  const tRes = useTranslations('Resources');
  const tPlan = useTranslations('WeekPlanner');
  return (
    <div className="border border-slate-200 rounded-lg p-3 text-sm" style={{ breakInside: 'avoid', borderLeft: `4px solid ${s.color}` }}>
      <div className="flex items-start gap-2">
        <SubjectIcon icon={s.icon} color={s.color} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800">
            {s.name} <span className="font-normal text-slate-500">· {tSubj(categoryKey(s.category))}</span>
          </p>
          <p className="text-slate-500">
            {t('subjectSchedule', { count: s.weekly_frequency, minutes: s.session_duration_minutes })}
            {s.scheduled_days.length > 0 && <> · {s.scheduled_days.map((d) => tPlan(DAY_SHORTS[d])).join(', ')}</>}
          </p>
        </div>
      </div>
      {s.short_description && <p className="text-slate-600 mt-2">{s.short_description}</p>}
      <div className="mt-2 space-y-1.5 text-slate-600">
        {s.taught_by && (
          <p className="flex items-center gap-1">
            <UserRound className="w-3.5 h-3.5 text-slate-400" />
            {t('subjectTaughtBy', { name: s.taught_by })}
          </p>
        )}
        {s.goals_for_period.length > 0 && (
          <div>
            <p className="font-medium text-slate-700">{t('subjectGoals')}</p>
            <ul className="ml-5 list-disc">{s.goals_for_period.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        )}
        {s.learning_objectives.length > 0 && (
          <div>
            <p className="font-medium text-slate-700">{t('subjectObjectives')}</p>
            <ul className="ml-5 list-disc">{s.learning_objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </div>
        )}
        {s.skills_targeted.length > 0 && (
          <p><span className="font-medium text-slate-700">{t('subjectSkills')}:</span> {s.skills_targeted.join(', ')}</p>
        )}
        {s.resources.length > 0 && (
          <div>
            <p className="font-medium text-slate-700">{t('subjectResources')}</p>
            <ul className="ml-5 list-disc">
              {s.resources.map((r) => (
                <li key={r.id}>
                  <span className="text-slate-800">{r.title}</span>
                  {r.author && <span> — {r.author}</span>}
                  <span className="text-slate-500"> ({tRes(getTypeKey(r.type))})</span>
                  {r.progress_notes && <span className="text-slate-500"> · {r.progress_notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.notes && <p className="italic">{s.notes}</p>}
        {showLogged && (
          <p className="text-xs text-slate-500">
            {t('subjectLogged', { count: s.sessions_logged, hours: Math.round(s.minutes_logged / 6) / 10 })}
          </p>
        )}
      </div>
    </div>
  );
}
