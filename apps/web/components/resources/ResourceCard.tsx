'use client';

import React from 'react';
import {
  BookOpen, FileText, Video, GraduationCap, Headphones, Film,
  FileSpreadsheet, Globe, Package, HelpCircle, Edit3, Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getServiceMeta } from '../../lib/getServiceMeta';

export interface ResourceSubjectLink {
  subject_id: string;
  subject_name: string;
  progress_notes: string | null;
  updated_at: string;
}

export interface Resource {
  id: string;
  family_id: string;
  title: string;
  type: string;
  author: string | null;
  description: string | null;
  url: string | null;
  subjects: ResourceSubjectLink[];
  created_at: string;
  updated_at: string;
}

interface ResourceCardProps {
  resource: Resource;
  onEdit: () => void;
  onDelete: () => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  book: BookOpen,
  article: FileText,
  video: Video,
  course: GraduationCap,
  podcast: Headphones,
  documentary: Film,
  printable: FileSpreadsheet,
  website: Globe,
  curriculum: Package,
  other: HelpCircle,
};

const TYPE_COLORS: Record<string, string> = {
  book: 'bg-blue-100 text-blue-700',
  article: 'bg-amber-100 text-amber-700',
  video: 'bg-red-100 text-red-700',
  course: 'bg-purple-100 text-purple-700',
  podcast: 'bg-green-100 text-green-700',
  documentary: 'bg-rose-100 text-rose-700',
  printable: 'bg-cyan-100 text-cyan-700',
  website: 'bg-indigo-100 text-indigo-700',
  curriculum: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-600',
};

export function getTypeKey(type: string): string {
  const map: Record<string, string> = {
    book: 'typeBook',
    article: 'typeArticle',
    video: 'typeVideo',
    course: 'typeCourse',
    podcast: 'typePodcast',
    documentary: 'typeDocumentary',
    printable: 'typePrintable',
    website: 'typeWebsite',
    curriculum: 'typeCurriculum',
    other: 'typeOther',
  };
  return map[type] || 'typeOther';
}

export function ResourceCard({ resource, onEdit, onDelete }: ResourceCardProps) {
  const t = useTranslations('Resources');
  const Icon = TYPE_ICONS[resource.type] || HelpCircle;
  const colorClass = TYPE_COLORS[resource.type] || TYPE_COLORS.other;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-800 truncate">{resource.title}</h3>
          {resource.author && (
            <p className="text-sm text-slate-500 mt-0.5">{t('by', { author: resource.author })}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
              {t(getTypeKey(resource.type))}
            </span>
            {resource.url && (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {getServiceMeta(resource.url).icon}
                <span>{getServiceMeta(resource.url).label}</span>
              </a>
            )}
          </div>
          {resource.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {resource.subjects.map((s) => (
                <span
                  key={s.subject_id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                >
                  {s.subject_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          {t('editTitle')}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('confirmDelete')}
        </button>
      </div>
    </div>
  );
}
