'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../lib/navigation';
import {
  Loader2, Plus, Search, BookOpen, FileText, Video, GraduationCap,
  Headphones, Film, FileSpreadsheet, Globe, Package, HelpCircle, X,
} from 'lucide-react';
import { getServiceMeta } from '../../lib/getServiceMeta';
import { getTypeKey } from './ResourceCard';

interface SubjectResource {
  id: string;
  title: string;
  type: string;
  author: string | null;
  url: string | null;
  progress_notes: string | null;
  progress_updated_at: string;
}

interface FamilyResource {
  id: string;
  title: string;
  type: string;
  author: string | null;
}

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

interface SubjectResourcesProps {
  subjectId: string;
  subjectName: string;
}

export function SubjectResources({ subjectId, subjectName }: SubjectResourcesProps) {
  const t = useTranslations('Resources');
  const router = useRouter();
  const [resources, setResources] = useState<SubjectResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProgress, setEditingProgress] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [allResources, setAllResources] = useState<FamilyResource[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [removeTarget, setRemoveTarget] = useState<SubjectResource | null>(null);

  useEffect(() => {
    fetchResources();
  }, [subjectId]);

  async function fetchResources() {
    setIsLoading(true);
    const res = await fetch(`/api/v1/resources/subject/${subjectId}`, { credentials: 'include' });
    if (res.ok) {
      setResources(await res.json());
    }
    setIsLoading(false);
  }

  async function openPicker() {
    const res = await fetch('/api/v1/resources', { credentials: 'include' });
    if (res.ok) {
      setAllResources(await res.json());
    }
    setShowPicker(true);
  }

  async function addResource(resourceId: string) {
    const res = await fetch(`/api/v1/resources/${resourceId}/subjects/${subjectId}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      setShowPicker(false);
      fetchResources();
    }
  }

  async function removeResource() {
    if (!removeTarget) return;
    const res = await fetch(`/api/v1/resources/${removeTarget.id}/subjects/${subjectId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setResources((prev) => prev.filter((r) => r.id !== removeTarget.id));
    }
    setRemoveTarget(null);
  }

  async function saveProgress(resourceId: string) {
    const res = await fetch(`/api/v1/resources/${resourceId}/subjects/${subjectId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ progress_notes: progressValue || null }),
    });
    if (res.ok) {
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, progress_notes: progressValue || null } : r
        )
      );
    }
    setEditingProgress(null);
  }

  const linkedIds = new Set(resources.map((r) => r.id));
  const availableResources = allResources.filter(
    (r) =>
      !linkedIds.has(r.id) &&
      (!pickerSearch ||
        r.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (r.author && r.author.toLowerCase().includes(pickerSearch.toLowerCase())))
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{t('resourcesTab')}</h3>
        <button
          onClick={openPicker}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addToSubject')}
        </button>
      </div>

      {resources.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-slate-500 mb-3">{t('noResourcesForSubject')}</p>
          <button
            onClick={openPicker}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('addResourceToSubject')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((r) => {
            const Icon = TYPE_ICONS[r.type] || HelpCircle;
            const colorClass = TYPE_COLORS[r.type] || TYPE_COLORS.other;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-primary/30 transition-all">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/resources/${r.id}`)}
                      className="text-sm font-medium text-slate-800 hover:text-primary truncate"
                    >
                      {r.title}
                    </button>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        {getServiceMeta(r.url).icon}
                      </a>
                    )}
                  </div>
                  {r.author && <p className="text-xs text-slate-400">{r.author}</p>}
                  {editingProgress === r.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={progressValue}
                        onChange={(e) => setProgressValue(e.target.value)}
                        placeholder={t('progressPlaceholder')}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveProgress(r.id);
                          if (e.key === 'Escape') setEditingProgress(null);
                        }}
                      />
                      <button onClick={() => saveProgress(r.id)} className="text-xs font-medium text-primary hover:underline">
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingProgress(r.id); setProgressValue(r.progress_notes || ''); }}
                      className="text-xs text-slate-400 hover:text-primary mt-0.5"
                    >
                      {r.progress_notes || t('progressPlaceholder')}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setRemoveTarget(r)}
                  className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Resource picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">{t('addToSubject')}</h3>
              <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('searchResources')}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {availableResources.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">{t('noResourcesForSubject')}</p>
              ) : (
                availableResources.map((r) => {
                  const Icon = TYPE_ICONS[r.type] || HelpCircle;
                  const colorClass = TYPE_COLORS[r.type] || TYPE_COLORS.other;
                  return (
                    <button
                      key={r.id}
                      onClick={() => addResource(r.id)}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                        {r.author && <p className="text-xs text-slate-400">{r.author}</p>}
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => { setShowPicker(false); router.push('/resources/new'); }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                {t('newResource')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setRemoveTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {t('removeFromSubjectTitle', { title: removeTarget.title, subject: subjectName })}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{t('removeFromSubjectMessage')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={removeResource}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                {t('confirmRemove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
