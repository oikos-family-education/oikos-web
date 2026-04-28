'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { Layers } from 'lucide-react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from './WidgetCard';

interface ProjectChildRow {
  project_id: string;
  child_id: string;
}

interface MilestoneCompletion {
  milestone_id: string;
  child_id: string;
}

interface ProjectListItem {
  id: string;
  family_id: string;
  title: string;
  due_date: string | null;
  status: string;
  children: ProjectChildRow[];
  milestone_count: number;
  completions: MilestoneCompletion[];
}

type DueTone = 'normal' | 'warn' | 'overdue';

function getDueDiffDays(due: string): number {
  const dueDate = new Date(due + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

function dueTone(diff: number): DueTone {
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'warn';
  return 'normal';
}

function formatAbsoluteDue(due: string): string {
  const dueDate = new Date(due + 'T00:00:00');
  return `Due ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(dueDate)}`;
}

export function OngoingProjects() {
  const t = useTranslations('Dashboard');
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/v1/projects?status=active', { credentials: 'include' });
      if (!res.ok) {
        setError(true);
        return;
      }
      const list: ProjectListItem[] = await res.json();
      setItems(list);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const headerActions = (
    <Link href="/projects" className="text-xs font-medium text-slate-500 hover:text-primary">
      {t('projectsViewAll')}
    </Link>
  );

  return (
    <WidgetCard title={t('projectsTitle')} actions={headerActions}>
      {loading && <WidgetSkeleton rows={2} />}
      {!loading && error && <WidgetError onRetry={load} />}
      {!loading && !error && items && items.length === 0 && (
        <WidgetEmpty
          icon={<Layers className="h-7 w-7" />}
          title={t('projectsEmpty')}
          cta={
            <Link href="/projects" className="text-xs font-medium text-primary hover:text-primary-hover">
              {t('projectsViewAll')} →
            </Link>
          }
        />
      )}
      {!loading && !error && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((p) => {
            // Estimate progress as completions / (milestones × children). If multiple children
            // each complete the same milestone we still treat them as separate units.
            const totalUnits =
              p.milestone_count * Math.max(1, p.children.length);
            const completed = p.completions.length;
            const pct = totalUnits > 0 ? Math.min(100, Math.round((completed / totalUnits) * 100)) : 0;
            const diff = p.due_date ? getDueDiffDays(p.due_date) : null;
            let dueText: string | null = null;
            let tone: DueTone = 'normal';
            if (p.due_date && diff !== null) {
              tone = dueTone(diff);
              if (tone === 'overdue') {
                dueText = t('projectsOverdue', { days: Math.abs(diff) });
              } else if (diff === 0) {
                dueText = t('projectsDueToday');
                tone = 'warn';
              } else if (tone === 'warn') {
                dueText = t('projectsDueIn', { days: diff });
              } else {
                dueText = formatAbsoluteDue(p.due_date);
              }
            }
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border border-slate-100 px-3 py-2.5 hover:border-primary/30 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="rounded-lg bg-violet-100 p-2 flex-shrink-0">
                      <Layers className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                        {dueText && (
                          <span
                            className={`text-[11px] font-medium flex-shrink-0 ${
                              tone === 'overdue'
                                ? 'text-red-500'
                                : tone === 'warn'
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {dueText}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('curriculumsChildren', { count: p.children.length })}
                        {p.milestone_count > 0 && (
                          <>
                            {' · '}
                            {t('projectsMilestones', {
                              done: Math.min(p.milestone_count, completed),
                              total: p.milestone_count,
                            })}
                          </>
                        )}
                      </p>
                      {p.milestone_count > 0 && (
                        <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
