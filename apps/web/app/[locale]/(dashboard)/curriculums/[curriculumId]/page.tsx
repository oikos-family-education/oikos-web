'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { categoryKey } from '../../../../../lib/categoryLabel';
import {
  Loader2, Calendar, BookOpen, BarChart3, LayoutGrid,
  MoreHorizontal, Pause, CheckCircle, Archive, Copy,
  Edit3, RotateCcw, Play, AlertTriangle,
} from 'lucide-react';

interface CurriculumSubject {
  id: string;
  subject_id: string;
  weekly_frequency: number;
  session_duration_minutes: number;
  scheduled_days: number[];
  preferred_time_slot: string;
  is_active: boolean;
  sort_order: number;
}

interface ChildCurriculum {
  id: string;
  child_id: string;
}

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  period_type: string;
  start_date: string;
  end_date: string;
  academic_year: string | null;
  term_name: string | null;
  education_philosophy: string | null;
  status: string;
  overall_goals: string[];
  notes: string | null;
  curriculum_subjects: CurriculumSubject[];
  child_curriculums: ChildCurriculum[];
}

interface Subject {
  id: string;
  name: string;
  color: string;
  category: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-amber-100 text-amber-700',
  paused: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-slate-100 text-slate-400',
  template: 'bg-violet-100 text-violet-700',
};

const TABS = ['Overview', 'Subjects', 'Schedule', 'Progress'] as const;
const TAB_ICONS = [LayoutGrid, BookOpen, Calendar, BarChart3];
const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];

export default function CurriculumDashboardPage() {
  const t = useTranslations('Curriculums');
  const tSubj = useTranslations('Subjects');
  const params = useParams();
  const router = useRouter();
  const curriculumId = params.curriculumId as string;

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Overview');
  const [showMenu, setShowMenu] = useState(false);
  const [activateConfirm, setActivateConfirm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [currRes, subjRes] = await Promise.all([
        fetch(`/api/v1/curriculums/${curriculumId}`, { credentials: 'include' }),
        fetch('/api/v1/subjects', { credentials: 'include' }),
      ]);
      if (currRes.ok) setCurriculum(await currRes.json());
      if (subjRes.ok) {
        const subjs: Subject[] = await subjRes.json();
        setSubjects(Object.fromEntries(subjs.map((s) => [s.id, s])));
      }
      setIsLoading(false);
    }
    load();
  }, [curriculumId]);

  async function updateStatus(newStatus: string, force: boolean = false) {
    setShowMenu(false);
    setStatusError(null);
    const res = await fetch(`/api/v1/curriculums/${curriculumId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus, force }),
    });
    if (res.ok) {
      setCurriculum(await res.json());
      setActivateConfirm(false);
    } else if (res.status === 409) {
      // Conflict: child already has an active curriculum
      setActivateConfirm(true);
    }
  }

  async function handleForceActivate() {
    await updateStatus('active', true);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!curriculum) {
    return <div className="text-center py-20 text-slate-500">Curriculum not found.</div>;
  }

  const isArchived = curriculum.status === 'archived';

  const totalWeeklyHours = curriculum.curriculum_subjects.reduce(
    (sum, cs) => sum + (cs.weekly_frequency * cs.session_duration_minutes) / 60,
    0
  );

  function getWeeksProgress() {
    const start = new Date(curriculum!.start_date);
    const end = new Date(curriculum!.end_date);
    const now = new Date();
    const total = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const current = Math.max(0, Math.min(total,
      Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
    ));
    return { current, total };
  }

  const progress = getWeeksProgress();

  return (
    <div className="max-w-5xl">
      {/* Activate conflict confirmation modal */}
      {activateConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setActivateConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="inline-flex p-2 rounded-lg bg-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{t('activateConflictTitle')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t('activateConflictMessage')}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setActivateConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t('cancelAction')}
                </button>
                <button
                  onClick={handleForceActivate}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover"
                >
                  {t('activateAndPauseOther')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-800">{curriculum.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[curriculum.status]}`}>
                {t(curriculum.status as any)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {curriculum.start_date} — {curriculum.end_date}
              </span>
              {curriculum.education_philosophy && (
                <span>· {curriculum.education_philosophy}</span>
              )}
              <span>· {curriculum.curriculum_subjects.length} subjects</span>
              <span>· {totalWeeklyHours.toFixed(1)}h/week</span>
            </div>
            {curriculum.status === 'active' && (
              <div className="flex items-center gap-2 mt-3 max-w-xs">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {t('weeksElapsed', { current: progress.current, total: progress.total })}
                </span>
              </div>
            )}
          </div>

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                {/* Edit — only for non-archived */}
                {!isArchived && (
                  <button onClick={() => { setShowMenu(false); router.push(`/curriculums/${curriculumId}/edit`); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <Edit3 className="w-4 h-4" /> {t('editCurriculum')}
                  </button>
                )}
                {/* Restore — only for archived */}
                {isArchived && (
                  <button onClick={() => updateStatus('draft')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <RotateCcw className="w-4 h-4" /> {t('restoreCurriculum')}
                  </button>
                )}
                {/* Activate — for draft and paused */}
                {['draft', 'paused'].includes(curriculum.status) && (
                  <button onClick={() => updateStatus('active')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50">
                    <Play className="w-4 h-4" /> {t('activateCurriculum')}
                  </button>
                )}
                {/* Pause — only for active */}
                {curriculum.status === 'active' && (
                  <button onClick={() => updateStatus('paused')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <Pause className="w-4 h-4" /> {t('pauseCurriculum')}
                  </button>
                )}
                {/* Complete — for active and paused */}
                {['active', 'paused'].includes(curriculum.status) && (
                  <button onClick={() => updateStatus('completed')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <CheckCircle className="w-4 h-4" /> {t('completeCurriculum')}
                  </button>
                )}
                {/* Archive — for anything not already archived or template */}
                {!['archived', 'template'].includes(curriculum.status) && (
                  <button onClick={() => updateStatus('archived')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <Archive className="w-4 h-4" /> {t('archiveCurriculum')}
                  </button>
                )}
                {/* Save as Template — for draft, active, paused */}
                {['draft', 'active', 'paused'].includes(curriculum.status) && (
                  <button onClick={() => updateStatus('template')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    <Copy className="w-4 h-4" /> {t('saveAsTemplate')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((tab, i) => {
          const Icon = TAB_ICONS[i];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(`dashboard${tab}` as any)}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {curriculum.overall_goals.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('goalsLabel')}</h3>
              <ul className="space-y-1.5">
                {curriculum.overall_goals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-primary mt-0.5">•</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {curriculum.curriculum_subjects.map((cs) => {
              const subject = subjects[cs.subject_id];
              if (!subject) return null;
              return (
                <div key={cs.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${subject.color}20` }}
                    >
                      <BookOpen className="w-4 h-4" style={{ color: subject.color }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-700">{subject.name}</h4>
                      <p className="text-xs text-slate-400">
                        {cs.weekly_frequency}x/wk · {cs.session_duration_minutes}m
                      </p>
                    </div>
                  </div>
                  {!cs.is_active && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                      {t('paused')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'Subjects' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="divide-y divide-slate-100">
            {curriculum.curriculum_subjects
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((cs) => {
                const subject = subjects[cs.subject_id];
                if (!subject) return null;
                return (
                  <div key={cs.id} className="flex items-center gap-4 p-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${subject.color}20` }}
                    >
                      <BookOpen className="w-5 h-5" style={{ color: subject.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-700">{subject.name}</h4>
                      <p className="text-xs text-slate-400">
                        {tSubj(categoryKey(subject.category))}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p>{cs.weekly_frequency} {t('sessionsPerWeek')}</p>
                      <p>{cs.session_duration_minutes} {t('minutesPerSession')}</p>
                    </div>
                    <div className="text-sm text-slate-400">
                      {cs.scheduled_days.length > 0
                        ? cs.scheduled_days.map((d) => t(DAY_KEYS[d] as any)).join(', ')
                        : '—'}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeTab === 'Schedule' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-7 gap-2">
            {DAY_KEYS.map((dk, dayIdx) => (
              <div key={dk}>
                <h4 className="text-xs font-semibold text-slate-500 uppercase text-center mb-2">
                  {t(dk as any)}
                </h4>
                <div className="space-y-1">
                  {curriculum.curriculum_subjects
                    .filter((cs) => cs.scheduled_days.includes(dayIdx))
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((cs) => {
                      const subject = subjects[cs.subject_id];
                      if (!subject) return null;
                      return (
                        <div
                          key={cs.id}
                          className="p-2 rounded-lg text-xs font-medium"
                          style={{
                            backgroundColor: `${subject.color}15`,
                            color: subject.color,
                          }}
                        >
                          {subject.name}
                          <span className="block text-[10px] opacity-70">
                            {cs.session_duration_minutes}m
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Progress' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Progress tracking will be available when lessons are generated.</p>
        </div>
      )}
    </div>
  );
}
