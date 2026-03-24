'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2, Check, BookOpen, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';
import { useAuth } from '../../providers/AuthProvider';
import { categoryKey } from '../../lib/categoryLabel';

interface Child {
  id: string;
  first_name: string;
  nickname: string | null;
}

interface Subject {
  id: string;
  name: string;
  category: string;
  color: string;
  default_session_duration_minutes: number;
  default_weekly_frequency: number;
}

interface SelectedSubject {
  subject_id: string;
  name: string;
  color: string;
  weekly_frequency: number;
  session_duration_minutes: number;
  scheduled_days: number[];
  preferred_time_slot: string;
  goals_for_period: string[];
  notes: string;
  expanded: boolean;
}

const PERIOD_TYPES = ['monthly', 'quarterly', 'semester', 'annual', 'custom'];
const PERIOD_WEEKS: Record<string, number> = { monthly: 4, quarterly: 13, semester: 18, annual: 36 };
const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
const TIME_SLOTS = ['morning_first', 'morning', 'midday', 'afternoon', 'flexible'];

export function CurriculumWizard() {
  const t = useTranslations('Curriculums');
  const tSubj = useTranslations('Subjects');
  const router = useRouter();
  const { family } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 data
  const [name, setName] = useState('');
  const [periodType, setPeriodType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [termName, setTermName] = useState('');
  const [philosophy, setPhilosophy] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 data
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);

  // Step 3 data
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<SelectedSubject[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');

  useEffect(() => {
    // Fetch children
    fetch('/api/v1/families/me/children', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setChildren);
    // Fetch subjects
    fetch('/api/v1/subjects', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setAvailableSubjects);
  }, []);

  // Auto-calculate end date
  useEffect(() => {
    if (startDate && periodType !== 'custom') {
      const weeks = PERIOD_WEEKS[periodType];
      if (weeks) {
        const start = new Date(startDate);
        start.setDate(start.getDate() + weeks * 7);
        setEndDate(start.toISOString().split('T')[0]);
      }
    }
  }, [startDate, periodType]);

  function addGoal() {
    if (goalInput.trim()) {
      setGoals([...goals, goalInput.trim()]);
      setGoalInput('');
    }
  }

  function toggleChild(childId: string) {
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    );
  }

  function addSubject(subject: Subject) {
    if (selectedSubjects.some((s) => s.subject_id === subject.id)) return;
    setSelectedSubjects([...selectedSubjects, {
      subject_id: subject.id,
      name: subject.name,
      color: subject.color,
      weekly_frequency: subject.default_weekly_frequency,
      session_duration_minutes: subject.default_session_duration_minutes,
      scheduled_days: [],
      preferred_time_slot: 'flexible',
      goals_for_period: [],
      notes: '',
      expanded: false,
    }]);
  }

  function removeSubject(subjectId: string) {
    setSelectedSubjects(selectedSubjects.filter((s) => s.subject_id !== subjectId));
  }

  function updateSubject(subjectId: string, field: string, value: any) {
    setSelectedSubjects(selectedSubjects.map((s) =>
      s.subject_id === subjectId ? { ...s, [field]: value } : s
    ));
  }

  function toggleSubjectDay(subjectId: string, day: number) {
    const subj = selectedSubjects.find((s) => s.subject_id === subjectId);
    if (!subj) return;
    const days = subj.scheduled_days.includes(day)
      ? subj.scheduled_days.filter((d) => d !== day)
      : [...subj.scheduled_days, day].sort();
    updateSubject(subjectId, 'scheduled_days', days);
  }

  function getTotalWeeklyHours() {
    return selectedSubjects.reduce(
      (sum, s) => sum + (s.weekly_frequency * s.session_duration_minutes) / 60,
      0
    );
  }

  function getHoursColor() {
    const hours = getTotalWeeklyHours();
    if (hours <= 25) return 'text-emerald-600';
    if (hours <= 35) return 'text-amber-600';
    return 'text-red-600';
  }

  async function handleSubmit(activate: boolean) {
    setIsLoading(true);
    setError('');

    const body = {
      name,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      academic_year: academicYear || null,
      term_name: termName || null,
      education_philosophy: philosophy || null,
      overall_goals: goals,
      notes: notes || null,
      child_ids: selectedChildIds,
      subjects: selectedSubjects.map((s, i) => ({
        subject_id: s.subject_id,
        weekly_frequency: s.weekly_frequency,
        session_duration_minutes: s.session_duration_minutes,
        scheduled_days: s.scheduled_days,
        preferred_time_slot: s.preferred_time_slot,
        goals_for_period: s.goals_for_period,
        sort_order: i,
        notes: s.notes || null,
      })),
    };

    const res = await fetch('/api/v1/curriculums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.detail || 'Something went wrong.');
      setIsLoading(false);
      return;
    }

    const created = await res.json();

    if (activate) {
      await fetch(`/api/v1/curriculums/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });
    }

    router.push(`/curriculums/${created.id}`);
  }

  const filteredSubjects = availableSubjects.filter(
    (s) => !selectedSubjects.some((sel) => sel.subject_id === s.id) &&
           s.name.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <button
              onClick={() => s < step && setStep(s)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                s === step
                  ? 'bg-primary text-white'
                  : s < step
                    ? 'bg-primary/10 text-primary cursor-pointer'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s < step ? <Check className="w-3.5 h-3.5" /> : s}
              <span className="hidden sm:inline">
                {t(`wizardStep${s}` as any)}
              </span>
            </button>
            {s < 4 && <div className="flex-1 h-0.5 bg-slate-200 rounded" />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1 — Plan Details */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800">{t('wizardStep1')}</h2>

          <Input
            label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('academicYearLabel')}
              placeholder={t('academicYearPlaceholder')}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
            <Input
              label={t('termNameLabel')}
              placeholder={t('termNamePlaceholder')}
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
            />
          </div>

          {/* Period type cards */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              {t('periodTypeLabel')}<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PERIOD_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setPeriodType(pt)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    periodType === pt
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t(`period${pt.charAt(0).toUpperCase() + pt.slice(1)}` as any)}
                </button>
              ))}
            </div>
            {periodType !== 'custom' && startDate && (
              <p className="text-xs text-slate-400 mt-1">
                {t('totalSchoolWeeks', { count: PERIOD_WEEKS[periodType] || 0 })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('startDateLabel')}
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label={t('endDateLabel')}
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <Input
            label={t('philosophyLabel')}
            value={philosophy}
            onChange={(e) => setPhilosophy(e.target.value)}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('goalsLabel')}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                placeholder={t('goalsPlaceholder')}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {goals.map((g, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {g}
                  <button type="button" onClick={() => setGoals(goals.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!name || !startDate || !endDate}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Assign Children */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800">{t('wizardStep2')}</h2>
          <p className="text-sm text-slate-500">{t('selectChildren')}</p>

          <div className="space-y-2">
            {children.map((child) => (
              <label
                key={child.id}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedChildIds.includes(child.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedChildIds.includes(child.id)}
                  onChange={() => toggleChild(child.id)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="font-medium text-slate-700">
                  {child.nickname || child.first_name}
                </span>
              </label>
            ))}
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
              {t('back')}
            </button>
            <Button onClick={() => setStep(3)}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Choose Subjects */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('wizardStep3')}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Available subjects */}
              <div>
                <input
                  type="text"
                  placeholder={t('searchSubjects')}
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {filteredSubjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => addSubject(subject)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${subject.color}20` }}
                      >
                        <BookOpen className="w-4 h-4" style={{ color: subject.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{subject.name}</p>
                        <p className="text-xs text-slate-400">{tSubj(categoryKey(subject.category))}</p>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Selected subjects */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">{t('selectedSubjects')}</h3>
                  <span className={`text-sm font-medium ${getHoursColor()}`}>
                    {getTotalWeeklyHours().toFixed(1)}h/wk
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedSubjects.map((subj) => (
                    <div key={subj.subject_id} className="border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3 p-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subj.color }}
                        />
                        <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                          {subj.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {subj.weekly_frequency}x {subj.session_duration_minutes}m
                        </span>
                        <button
                          onClick={() => updateSubject(subj.subject_id, 'expanded', !subj.expanded)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          {subj.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => removeSubject(subj.subject_id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {subj.expanded && (
                        <div className="border-t border-slate-100 p-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-slate-500 block mb-1">{t('sessionsPerWeek')}</label>
                              <input
                                type="number"
                                min={1}
                                max={7}
                                value={subj.weekly_frequency}
                                onChange={(e) => updateSubject(subj.subject_id, 'weekly_frequency', Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 block mb-1">{t('minutesPerSession')}</label>
                              <input
                                type="number"
                                min={5}
                                max={480}
                                step={5}
                                value={subj.session_duration_minutes}
                                onChange={(e) => updateSubject(subj.subject_id, 'session_duration_minutes', Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">{t('scheduledDaysLabel')}</label>
                            <div className="flex gap-1">
                              {DAY_KEYS.map((dk, i) => (
                                <button
                                  key={dk}
                                  type="button"
                                  onClick={() => toggleSubjectDay(subj.subject_id, i)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    subj.scheduled_days.includes(i)
                                      ? 'bg-primary text-white'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {t(dk as any)}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">{t('timeSlotLabel')}</label>
                            <select
                              value={subj.preferred_time_slot}
                              onChange={(e) => updateSubject(subj.subject_id, 'preferred_time_slot', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                            >
                              {TIME_SLOTS.map((slot) => (
                                <option key={slot} value={slot}>
                                  {t(`slot${slot.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as any)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
              {t('back')}
            </button>
            <Button onClick={() => setStep(4)} disabled={selectedSubjects.length === 0}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Review & Activate */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('wizardStep4')}</h2>
            <p className="text-sm text-slate-500 mb-6">{t('reviewSummary')}</p>

            {/* Summary table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-500 font-medium">{t('subject')}</th>
                    <th className="text-center py-2 text-slate-500 font-medium">{t('sessions')}</th>
                    <th className="text-center py-2 text-slate-500 font-medium">{t('duration')}</th>
                    <th className="text-center py-2 text-slate-500 font-medium">{t('days')}</th>
                    <th className="text-right py-2 text-slate-500 font-medium">{t('weeklyHours')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSubjects.map((subj) => (
                    <tr key={subj.subject_id} className="border-b border-slate-100">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subj.color }} />
                          <span className="font-medium text-slate-700">{subj.name}</span>
                        </div>
                      </td>
                      <td className="text-center text-slate-600">{subj.weekly_frequency}</td>
                      <td className="text-center text-slate-600">{subj.session_duration_minutes}m</td>
                      <td className="text-center text-slate-600">
                        {subj.scheduled_days.length > 0
                          ? subj.scheduled_days.map((d) => t(DAY_KEYS[d] as any)).join(', ')
                          : '—'}
                      </td>
                      <td className="text-right text-slate-600">
                        {((subj.weekly_frequency * subj.session_duration_minutes) / 60).toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={4} className="py-2.5 font-semibold text-slate-700">{t('totalWeeklyHours')}</td>
                    <td className={`text-right font-semibold ${getHoursColor()}`}>
                      {getTotalWeeklyHours().toFixed(1)}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
              {t('back')}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {t('saveAsDraft')}
              </button>
              <Button onClick={() => handleSubmit(true)} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('activateCurriculum')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
