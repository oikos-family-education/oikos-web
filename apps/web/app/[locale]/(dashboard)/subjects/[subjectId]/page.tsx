'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Loader2, Edit3, BookOpen, Library, ArrowLeft,
  Clock, CalendarDays, Target, Sparkles, Users,
} from 'lucide-react';
import { categoryKey } from '../../../../../lib/categoryLabel';
import { SubjectResources } from '../../../../../components/resources/SubjectResources';

interface Subject {
  id: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string;
  color: string;
  icon: string | null;
  priority: number;
  min_age_years: number | null;
  max_age_years: number | null;
  default_session_duration_minutes: number;
  default_weekly_frequency: number;
  learning_objectives: string[];
  skills_targeted: string[];
  is_platform_subject: boolean;
  is_public: boolean;
  family_id: string | null;
}

const PRIORITY_MAP: Record<number, { label: string; key: string; color: string }> = {
  1: { label: 'High', key: 'priorityHigh', color: 'bg-red-100 text-red-700' },
  2: { label: 'Medium', key: 'priorityMedium', color: 'bg-amber-100 text-amber-700' },
  3: { label: 'Low', key: 'priorityLow', color: 'bg-slate-100 text-slate-600' },
};

export default function SubjectDetailPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const router = useRouter();
  const t = useTranslations('Subjects');
  const tRes = useTranslations('Resources');

  const [subject, setSubject] = useState<Subject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources'>('overview');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/subjects/${subjectId}`, { credentials: 'include' });
      if (res.ok) {
        setSubject(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, [subjectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subject) {
    return <div className="text-center py-20 text-slate-500">Subject not found.</div>;
  }

  const priority = PRIORITY_MAP[subject.priority] || PRIORITY_MAP[2];

  const tabs = [
    { key: 'overview' as const, label: t('detailOverview'), icon: BookOpen },
    { key: 'resources' as const, label: tRes('resourcesTab'), icon: Library },
  ];

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => router.push('/subjects')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('title')}
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${subject.color}20` }}
            >
              <BookOpen className="w-6 h-6" style={{ color: subject.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{subject.name}</h1>
              {subject.short_description && (
                <p className="text-slate-500 mt-1">{subject.short_description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${subject.color}15`, color: subject.color }}
                >
                  {t(categoryKey(subject.category) as any)}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
                  {t(priority.key as any)}
                </span>
                {subject.is_platform_subject && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {t('platformBadge')}
                  </span>
                )}
                {subject.is_public && !subject.is_platform_subject && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {t('communityBadge')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {subject.family_id && !subject.is_platform_subject && (
            <button
              onClick={() => router.push(`/subjects/${subjectId}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              {t('edit')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(subject.min_age_years != null || subject.max_age_years != null) && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">{t('detailAgeRange')}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {subject.min_age_years ?? 0}–{subject.max_age_years ?? 25} {t('detailYears')}
                </p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">{t('detailSessionDuration')}</span>
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {subject.default_session_duration_minutes} {t('detailMin')}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">{t('detailFrequency')}</span>
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {subject.default_weekly_frequency}x / {t('detailWeek')}
              </p>
            </div>
          </div>

          {/* Description */}
          {(subject.long_description || subject.short_description) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('detailDescription')}</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {subject.long_description || subject.short_description}
              </p>
            </div>
          )}

          {/* Learning Objectives */}
          {subject.learning_objectives && subject.learning_objectives.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-slate-700">{t('detailLearningObjectives')}</h3>
              </div>
              <ul className="space-y-1.5">
                {subject.learning_objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-primary mt-0.5">•</span>
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Targeted */}
          {subject.skills_targeted && subject.skills_targeted.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-slate-700">{t('detailSkillsTargeted')}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {subject.skills_targeted.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'resources' && (
        <SubjectResources subjectId={subjectId} subjectName={subject.name} />
      )}
    </div>
  );
}
