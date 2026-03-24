'use client';

import React from 'react';
import { BookOpen, GitFork, Edit3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { categoryKey } from '../../lib/categoryLabel';

interface Subject {
  id: string;
  family_id: string | null;
  name: string;
  short_description: string | null;
  category: string;
  color: string;
  icon: string | null;
  min_age_years: number | null;
  max_age_years: number | null;
  is_platform_subject: boolean;
  is_public: boolean;
}

interface SubjectCardProps {
  subject: Subject;
  onFork: () => void;
  onEdit: () => void;
}

export function SubjectCard({ subject, onFork, onEdit }: SubjectCardProps) {
  const t = useTranslations('Subjects');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${subject.color}20` }}
        >
          <BookOpen className="w-5 h-5" style={{ color: subject.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-slate-800 truncate">{subject.name}</h3>
            {subject.is_platform_subject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary flex-shrink-0">
                {t('platformBadge')}
              </span>
            )}
            {subject.is_public && !subject.is_platform_subject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">
                {t('communityBadge')}
              </span>
            )}
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 mb-2">
            {t(categoryKey(subject.category))}
          </span>
          {subject.short_description && (
            <p className="text-sm text-slate-500 line-clamp-2">{subject.short_description}</p>
          )}
          {subject.min_age_years != null && subject.max_age_years != null && (
            <p className="text-xs text-slate-400 mt-2">
              {t('ages', { min: subject.min_age_years, max: subject.max_age_years })}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
        {subject.is_platform_subject ? (
          <button
            onClick={onFork}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <GitFork className="w-3.5 h-3.5" />
            {t('forkAndCustomise')}
          </button>
        ) : subject.family_id ? (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {t('edit')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
