'use client';

import React from 'react';
import { icons, BookOpen, GitFork, Edit3, Trash2, ChevronUp, Minus, ChevronDown } from 'lucide-react';
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
  priority?: number;
  min_age_years: number | null;
  max_age_years: number | null;
  is_platform_subject: boolean;
  is_public: boolean;
}

interface SubjectCardProps {
  subject: Subject;
  onFork: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

const PRIORITY_CONFIG: Record<number, { icon: React.ElementType; color: string; key: string }> = {
  1: { icon: ChevronUp, color: 'text-red-500', key: 'priorityHigh' },
  2: { icon: Minus, color: 'text-amber-500', key: 'priorityMedium' },
  3: { icon: ChevronDown, color: 'text-slate-400', key: 'priorityLow' },
};

function SubjectIcon({ iconName, color }: { iconName: string | null; color: string }) {
  const name = iconName || 'BookOpen';
  if (name in icons) {
    return React.createElement(icons[name as keyof typeof icons], {
      className: 'w-5 h-5',
      style: { color },
    });
  }
  return <BookOpen className="w-5 h-5" style={{ color }} />;
}

export function SubjectCard({ subject, onFork, onEdit, onDelete }: SubjectCardProps) {
  const t = useTranslations('Subjects');
  const priorityCfg = PRIORITY_CONFIG[subject.priority ?? 2];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${subject.color}20` }}
        >
          <SubjectIcon iconName={subject.icon} color={subject.color} />
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
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {t(categoryKey(subject.category))}
            </span>
            {priorityCfg && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${priorityCfg.color}`}>
                {React.createElement(priorityCfg.icon, { className: 'w-3.5 h-3.5' })}
                {t(priorityCfg.key)}
              </span>
            )}
          </div>
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
          <>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {t('edit')}
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('delete')}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
