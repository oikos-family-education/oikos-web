'use client';

import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, Loader2, Calendar, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface CurriculumListItem {
  id: string;
  name: string;
  description: string | null;
  period_type: string;
  start_date: string;
  end_date: string;
  academic_year: string | null;
  status: string;
  education_philosophy: string | null;
  created_at: string;
}

const STATUS_ORDER = ['active', 'draft', 'paused', 'completed', 'archived', 'template'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-amber-100 text-amber-700',
  paused: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-slate-100 text-slate-400',
  template: 'bg-violet-100 text-violet-700',
};

export default function CurriculumsPage() {
  const t = useTranslations('Curriculums');
  const router = useRouter();
  const [curriculums, setCurriculums] = useState<CurriculumListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/v1/curriculums', { credentials: 'include' });
      if (res.ok) {
        setCurriculums(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const grouped = STATUS_ORDER.reduce<Record<string, CurriculumListItem[]>>((acc, status) => {
    const items = curriculums.filter((c) => c.status === status);
    if (items.length > 0) acc[status] = items;
    return acc;
  }, {});

  function getWeeksProgress(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const totalWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const elapsedWeeks = Math.max(0, Math.min(totalWeeks,
      Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
    ));
    return { current: elapsedWeeks, total: totalWeeks };
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/curriculums/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('newCurriculum')}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : curriculums.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('emptyTitle')}</h3>
          <p className="text-slate-500 mb-6">{t('emptyDescription')}</p>
          <button
            onClick={() => router.push('/curriculums/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('emptyAction')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([status, items]) => (
            <div key={status}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t(status as any)}
              </h2>
              <div className="space-y-3">
                {items.map((curriculum) => {
                  const progress = getWeeksProgress(curriculum.start_date, curriculum.end_date);
                  return (
                    <button
                      key={curriculum.id}
                      onClick={() => router.push(`/curriculums/${curriculum.id}`)}
                      className="w-full text-left bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-slate-800 truncate">{curriculum.name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                              {t(status as any)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {curriculum.start_date} — {curriculum.end_date}
                            </span>
                            {curriculum.education_philosophy && (
                              <span className="text-slate-400">· {curriculum.education_philosophy}</span>
                            )}
                          </div>
                          {status === 'active' && (
                            <div className="mt-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400">
                                  {t('weeksElapsed', { current: progress.current, total: progress.total })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 ml-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
