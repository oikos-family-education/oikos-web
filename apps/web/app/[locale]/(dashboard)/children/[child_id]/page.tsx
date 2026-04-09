'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Pencil, Loader2, ArrowRight, GraduationCap, Layers,
  Archive, BookOpen, Brain, Heart, Lightbulb, AlertCircle, HandHelping,
  Calendar, User,
} from 'lucide-react';
import { Button } from '@oikos/ui';
import { AddChildForm, ChildFormData } from '../../../../../components/onboarding/AddChildForm';
import { ArchiveModal } from '../../../../../components/children/ArchiveModal';

interface Child {
  id: string;
  family_id: string;
  first_name: string;
  nickname?: string;
  gender?: string;
  birthdate?: string;
  birth_year?: number;
  birth_month?: number;
  grade_level?: string;
  child_curriculum: string[];
  learning_styles: string[];
  personality_description?: string;
  interests: string[];
  motivators?: string;
  demotivators?: string;
  learning_differences: string[];
  accommodations_notes?: string;
  support_services: string[];
  is_active: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

interface ChildCurriculum {
  child_id: string;
}

interface EnrolledCurriculum {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  education_philosophy?: string;
  child_curriculums: ChildCurriculum[];
}

const GRADE_LABELS: Record<string, string> = {
  pre_k: 'Pre-K', k: 'Kindergarten',
  grade_1: 'Grade 1', grade_2: 'Grade 2', grade_3: 'Grade 3',
  grade_4: 'Grade 4', grade_5: 'Grade 5', grade_6: 'Grade 6',
  grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9',
  grade_10: 'Grade 10', grade_11: 'Grade 11', grade_12: 'Grade 12',
  stage_early: 'Early Stage', stage_middle: 'Middle Stage',
  stage_upper: 'Upper Stage', graduated: 'Graduated',
};

const LEARNING_STYLE_LABELS: Record<string, string> = {
  visual: 'Visual', auditory: 'Auditory', kinesthetic: 'Kinesthetic',
  reading_writing: 'Reading-Writing', social: 'Social',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-amber-100 text-amber-700',
  paused: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-700',
};

function getInitials(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getInitialColor(name: string): string {
  const colors = [
    'from-violet-400 to-violet-600', 'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600', 'from-amber-400 to-amber-600',
    'from-rose-400 to-rose-600', 'from-cyan-400 to-cyan-600',
    'from-fuchsia-400 to-fuchsia-600', 'from-indigo-400 to-indigo-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function computeAge(birthdate?: string, birthYear?: number): number | null {
  const now = new Date();
  if (birthdate) {
    const bd = new Date(birthdate);
    let age = now.getFullYear() - bd.getFullYear();
    const monthDiff = now.getMonth() - bd.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) age--;
    return age;
  }
  if (birthYear) return now.getFullYear() - birthYear;
  return null;
}

function TagList({ items, color = 'primary' }: { items: string[]; color?: 'primary' | 'slate' }) {
  if (items.length === 0) return null;
  const colorClasses = color === 'primary'
    ? 'text-primary bg-primary/10'
    : 'text-slate-600 bg-slate-100';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <span key={item} className={`text-xs px-2.5 py-1 rounded-full font-medium ${colorClasses}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

interface ProfileSectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  muted?: boolean;
}

function ProfileSection({ icon: Icon, title, children, muted }: ProfileSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${muted ? 'text-slate-300' : 'text-slate-500'}`} />
        <h3 className={`text-sm font-semibold ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{title}</h3>
      </div>
      <div className={muted ? 'text-sm text-slate-400 italic' : 'text-sm text-slate-600'}>
        {children}
      </div>
    </div>
  );
}

export default function ChildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('Children');
  const childId = params.child_id as string;

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [enrolledCurriculums, setEnrolledCurriculums] = useState<EnrolledCurriculum[]>([]);

  const fetchChild = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/families/me/children/${childId}`, { credentials: 'include' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        setChild(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [childId]);

  const fetchCurriculums = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/curriculums', { credentials: 'include' });
      if (res.ok) {
        const all: EnrolledCurriculum[] = await res.json();
        const enrolled = all.filter(c =>
          (c.child_curriculums || []).some(cc => cc.child_id === childId)
        );
        setEnrolledCurriculums(enrolled);
      }
    } catch {
      // silently fail
    }
  }, [childId]);

  useEffect(() => {
    fetchChild();
    fetchCurriculums();
  }, [fetchChild, fetchCurriculums]);

  const handleEditSuccess = (_child: ChildFormData & { id?: string }) => {
    setShowEdit(false);
    fetchChild();
  };

  const handleArchiveConfirm = async () => {
    try {
      const res = await fetch(`/api/v1/families/me/children/${childId}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        router.push('/children');
      }
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !child) {
    return (
      <div className="max-w-5xl text-center py-16">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">{t('childNotFound')}</h2>
        <p className="text-slate-500 mb-6">{t('childNotFoundDesc')}</p>
        <Button onClick={() => router.push('/children')} className="px-5 py-2 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToChildren')}
        </Button>
      </div>
    );
  }

  const age = computeAge(child.birthdate, child.birth_year);
  const gradeLabel = child.grade_level ? GRADE_LABELS[child.grade_level] ?? child.grade_level : null;
  const displayName = child.nickname ? child.nickname : child.first_name;
  const fullLabel = child.nickname ? `${child.nickname} (${child.first_name})` : child.first_name;
  const initials = getInitials(displayName);
  const colorClass = getInitialColor(child.first_name);
  const notSpec = t('notSpecified');

  if (showEdit) {
    return (
      <div className="max-w-5xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <AddChildForm
            onSuccess={handleEditSuccess}
            onCancel={() => setShowEdit(false)}
            translationNamespace="Children"
            childId={child.id}
            initialData={{
              first_name: child.first_name,
              nickname: child.nickname,
              gender: child.gender,
              birthdate: child.birthdate,
              birth_year: child.birth_year,
              birth_month: child.birth_month,
              grade_level: child.grade_level,
              learning_styles: child.learning_styles,
              personality_description: child.personality_description,
              interests: child.interests,
              motivators: child.motivators,
              demotivators: child.demotivators,
              learning_differences: child.learning_differences,
              accommodations_notes: child.accommodations_notes,
              support_services: child.support_services,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* Back link */}
      <button
        onClick={() => router.push('/children')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToChildren')}
      </button>

      {/* Page Header */}
      <div className="flex items-start gap-5">
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-bold text-xl">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">{fullLabel}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {age !== null && <span className="text-slate-500">{t('yearsOld', { age })}</span>}
            {gradeLabel && <span className="text-slate-500">{gradeLabel}</span>}
          </div>
          {child.learning_styles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {child.learning_styles.map(ls => (
                <span key={ls} className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                  {LEARNING_STYLE_LABELS[ls] ?? ls}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={() => setShowEdit(true)} className="px-4 py-2 rounded-xl">
            <Pencil className="w-4 h-4 mr-2" />
            {t('edit')}
          </Button>
          <button
            onClick={() => setShowArchive(true)}
            className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors inline-flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            {t('archive')}
          </button>
        </div>
      </div>

      {/* Profile Summary — Card-based layout */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6">{t('profileSummary')}</h2>

        {/* Top row: key facts in a compact grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{t('gradeLevel')}</span>
            </div>
            <p className={`text-sm font-semibold ${gradeLabel ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {gradeLabel || notSpec}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{t('dateOfBirth')}</span>
            </div>
            <p className={`text-sm font-semibold ${child.birthdate || child.birth_year ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {child.birthdate || (child.birth_year ? `${child.birth_year}` : notSpec)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{t('gender')}</span>
            </div>
            <p className={`text-sm font-semibold ${child.gender ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {child.gender ? child.gender.charAt(0).toUpperCase() + child.gender.slice(1).replace(/_/g, ' ') : notSpec}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{t('learningStyles')}</span>
            </div>
            <p className={`text-sm font-semibold ${child.learning_styles.length > 0 ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {child.learning_styles.length > 0
                ? child.learning_styles.map(ls => LEARNING_STYLE_LABELS[ls] ?? ls).join(', ')
                : notSpec}
            </p>
          </div>
        </div>

        {/* Detail sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <ProfileSection icon={Heart} title={t('interests')} muted={child.interests.length === 0}>
            {child.interests.length > 0 ? <TagList items={child.interests} color="primary" /> : notSpec}
          </ProfileSection>

          <ProfileSection icon={BookOpen} title={t('personality')} muted={!child.personality_description}>
            {child.personality_description || notSpec}
          </ProfileSection>

          <ProfileSection icon={Lightbulb} title={t('motivators')} muted={!child.motivators}>
            {child.motivators || notSpec}
          </ProfileSection>

          <ProfileSection icon={AlertCircle} title={t('demotivators')} muted={!child.demotivators}>
            {child.demotivators || notSpec}
          </ProfileSection>

          <ProfileSection icon={Brain} title={t('learningDifferences')} muted={child.learning_differences.length === 0}>
            {child.learning_differences.length > 0 ? <TagList items={child.learning_differences} color="slate" /> : notSpec}
          </ProfileSection>

          <ProfileSection icon={HandHelping} title={t('accommodations')} muted={!child.accommodations_notes}>
            {child.accommodations_notes || notSpec}
          </ProfileSection>

          <ProfileSection icon={HandHelping} title={t('supportServices')} muted={child.support_services.length === 0}>
            {child.support_services.length > 0 ? <TagList items={child.support_services} color="slate" /> : notSpec}
          </ProfileSection>
        </div>
      </div>

      {/* Curriculum Panel — now fetches actual enrollments */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex p-2 rounded-xl bg-primary/10">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{t('curriculum')}</h2>
        </div>
        {enrolledCurriculums.length > 0 ? (
          <div className="space-y-3 mb-4">
            {enrolledCurriculums.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/curriculums/${c.id}`)}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.start_date} — {c.end_date}{c.education_philosophy ? ` · ${c.education_philosophy}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-500'}`}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic mb-4">{t('noCurriculum')}</p>
        )}
        <button
          onClick={() => router.push('/curriculums')}
          className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          {t('manageCurriculum')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Projects Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex p-2 rounded-xl bg-primary/10">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{t('projects')}</h2>
        </div>
        <p className="text-sm text-slate-400 italic mb-4">{t('noProjects')}</p>
        <button
          onClick={() => router.push(`/projects?child=${child.id}`)}
          className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          {t('viewProjects')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Archive Modal */}
      {showArchive && (
        <ArchiveModal
          childName={child.first_name}
          onConfirm={handleArchiveConfirm}
          onCancel={() => setShowArchive(false)}
        />
      )}
    </div>
  );
}
