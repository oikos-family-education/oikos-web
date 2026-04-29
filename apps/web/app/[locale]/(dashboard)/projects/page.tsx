'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../lib/navigation';

interface ProjectChild {
  project_id: string;
  child_id: string;
  assigned_at: string;
}

interface ProjectSubject {
  project_id: string;
  subject_id: string;
  is_primary: boolean;
}

interface MilestoneCompletion {
  id: string;
  milestone_id: string;
  child_id: string;
  completed_at: string;
}

interface Project {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  children: ProjectChild[];
  subjects: ProjectSubject[];
  milestone_count: number;
  completions: MilestoneCompletion[];
}

interface Child {
  id: string;
  first_name: string;
  nickname: string | null;
  avatar_initials: string | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function ProjectsPage() {
  const t = useTranslations('Projects');
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [childFilter, setChildFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, childFilter, subjectFilter]);

  useEffect(() => {
    async function loadData() {
      const [childRes, subjRes] = await Promise.all([
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
      ]);
      if (childRes.ok) setChildren(await childRes.json());
      if (subjRes.ok) setSubjects(await subjRes.json());
    }
    loadData();
  }, []);

  async function fetchProjects() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (childFilter) params.set('child_id', childFilter);
    if (subjectFilter) params.set('subject_id', subjectFilter);

    const res = await fetch(`/api/v1/projects?${params}`, { credentials: 'include' });
    if (res.ok) setProjects(await res.json());
    setIsLoading(false);
  }

  function getChildName(childId: string): string {
    const child = children.find((c) => c.id === childId);
    return child?.nickname || child?.first_name || '';
  }

  function getChildInitials(childId: string): string {
    const child = children.find((c) => c.id === childId);
    return child?.avatar_initials || (child?.first_name?.[0] ?? '?');
  }

  function getSubjectName(subjectId: string): string {
    const subject = subjects.find((s) => s.id === subjectId);
    return subject?.name || '';
  }

  function getSubjectColor(subjectId: string): string {
    const subject = subjects.find((s) => s.id === subjectId);
    return subject?.color || '#6366F1';
  }

  function isOverdue(project: Project): boolean {
    if (!project.due_date) return false;
    if (project.status === 'complete' || project.status === 'archived') return false;
    return new Date(project.due_date) < new Date();
  }

  function getChildProgress(project: Project, childId: string): number {
    if (project.milestone_count === 0) return 0;
    const completed = project.completions.filter((c) => c.child_id === childId).length;
    return Math.round((completed / project.milestone_count) * 100);
  }

  // Client-side search
  let filtered = projects;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((p) => p.title.toLowerCase().includes(q));
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    active: 'bg-primary/10 text-primary',
    complete: 'bg-green-100 text-green-700',
    archived: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/projects/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('newProject')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">{t('filterAllStatuses')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="active">{t('statusActive')}</option>
          <option value="complete">{t('statusComplete')}</option>
        </select>
        {children.length > 0 && (
          <select
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">{t('filterAllChildren')}</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname || c.first_name}
              </option>
            ))}
          </select>
        )}
        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">{t('filterAllSubjects')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Layers className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('emptyTitle')}</h3>
          <p className="text-slate-500 mb-6">{t('emptyDescription')}</p>
          <button
            onClick={() => router.push('/projects/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('emptyAction')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-800 truncate">{project.title}</h3>
                  {project.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{project.description}</p>
                  )}
                </div>
                <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[project.status]}`}>
                  {t(`status${project.status.charAt(0).toUpperCase() + project.status.slice(1)}` as any)}
                </span>
              </div>

              {/* Due date & overdue */}
              {project.due_date && (
                <div className="flex items-center gap-1 mb-3 text-sm">
                  <span className={`inline-flex items-center gap-1 ${isOverdue(project) ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    {isOverdue(project) && <AlertTriangle className="w-3.5 h-3.5" />}
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.due_date).toLocaleDateString()}
                  </span>
                  {isOverdue(project) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium">{t('overdue')}</span>
                  )}
                </div>
              )}

              {/* Assigned children with initials */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex -space-x-1">
                  {project.children.map((pc) => (
                    <div
                      key={pc.child_id}
                      title={getChildName(pc.child_id)}
                      className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center border-2 border-white"
                    >
                      {getChildInitials(pc.child_id)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject tags */}
              {project.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.subjects.map((ps) => (
                    <span
                      key={ps.subject_id}
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${getSubjectColor(ps.subject_id)}15`,
                        color: getSubjectColor(ps.subject_id),
                      }}
                    >
                      {getSubjectName(ps.subject_id)}
                    </span>
                  ))}
                </div>
              )}

              {/* Per-child progress bars */}
              {project.milestone_count > 0 && (
                <div className="space-y-1.5">
                  {project.children.map((pc) => {
                    const pct = getChildProgress(project, pc.child_id);
                    return (
                      <div key={pc.child_id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-16 truncate">{getChildName(pc.child_id)}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
