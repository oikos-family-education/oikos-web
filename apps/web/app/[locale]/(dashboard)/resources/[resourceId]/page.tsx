'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Loader2, Edit3, Trash2, BookOpen, FileText, Video, GraduationCap,
  Headphones, Film, FileSpreadsheet, Globe, Package, HelpCircle, ExternalLink,
} from 'lucide-react';
import { Resource, getTypeKey } from '../../../../../components/resources/ResourceCard';
import { ResourceForm } from '../../../../../components/resources/ResourceForm';
import { getServiceMeta } from '../../../../../lib/getServiceMeta';

const TYPE_ICONS: Record<string, React.ElementType> = {
  book: BookOpen, article: FileText, video: Video, course: GraduationCap,
  podcast: Headphones, documentary: Film, printable: FileSpreadsheet,
  website: Globe, curriculum: Package, other: HelpCircle,
};

const TYPE_COLORS: Record<string, string> = {
  book: 'bg-blue-100 text-blue-700', article: 'bg-amber-100 text-amber-700',
  video: 'bg-red-100 text-red-700', course: 'bg-purple-100 text-purple-700',
  podcast: 'bg-green-100 text-green-700', documentary: 'bg-rose-100 text-rose-700',
  printable: 'bg-cyan-100 text-cyan-700', website: 'bg-indigo-100 text-indigo-700',
  curriculum: 'bg-teal-100 text-teal-700', other: 'bg-slate-100 text-slate-600',
};

export default function ResourceDetailPage() {
  const params = useParams();
  const resourceId = params.resourceId as string;
  const router = useRouter();
  const t = useTranslations('Resources');

  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProgress, setEditingProgress] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/resources/${resourceId}`, { credentials: 'include' });
      if (res.ok) {
        setResource(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, [resourceId]);

  async function handleDelete() {
    const res = await fetch(`/api/v1/resources/${resourceId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      router.push('/resources');
    }
  }

  async function saveProgress(subjectId: string) {
    const res = await fetch(`/api/v1/resources/${resourceId}/subjects/${subjectId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ progress_notes: progressValue || null }),
    });
    if (res.ok && resource) {
      setResource({
        ...resource,
        subjects: resource.subjects.map((s) =>
          s.subject_id === subjectId ? { ...s, progress_notes: progressValue || null } : s
        ),
      });
    }
    setEditingProgress(null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resource) {
    return <div className="text-center py-20 text-slate-500">Resource not found.</div>;
  }

  const Icon = TYPE_ICONS[resource.type] || HelpCircle;
  const colorClass = TYPE_COLORS[resource.type] || TYPE_COLORS.other;

  if (isEditing) {
    return <ResourceForm initialData={resource} isEditing />;
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{resource.title}</h1>
            {resource.author && (
              <p className="text-slate-500 mt-1">{t('by', { author: resource.author })}</p>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${colorClass}`}>
              {t(getTypeKey(resource.type) as any)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {t('editTitle')}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('confirmDelete')}
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
        {resource.description && (
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">{t('descriptionLabel')}</label>
            <p className="text-sm text-slate-600">{resource.description}</p>
          </div>
        )}
        {resource.url && (
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">{t('urlLabel')}</label>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {getServiceMeta(resource.url).icon}
              <span>{getServiceMeta(resource.url).label}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Linked Subjects with progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('linkedSubjects')}</h2>
        {resource.subjects.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noSubjectsLinked')}</p>
        ) : (
          <div className="space-y-3">
            {resource.subjects.map((s) => (
              <div key={s.subject_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-slate-800">{s.subject_name}</span>
                  {editingProgress === s.subject_id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={progressValue}
                        onChange={(e) => setProgressValue(e.target.value)}
                        placeholder={t('progressPlaceholder')}
                        className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveProgress(s.subject_id);
                          if (e.key === 'Escape') setEditingProgress(null);
                        }}
                      />
                      <button
                        onClick={() => saveProgress(s.subject_id)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProgress(null)}
                        className="text-xs font-medium text-slate-400 hover:underline"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingProgress(s.subject_id);
                        setProgressValue(s.progress_notes || '');
                      }}
                      className="block text-xs text-slate-400 hover:text-primary mt-0.5 cursor-pointer"
                    >
                      {s.progress_notes || t('progressPlaceholder')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {t('deleteConfirmTitle', { title: resource.title })}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {t('deleteConfirmMessage', { count: resource.subjects.length })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                {t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
