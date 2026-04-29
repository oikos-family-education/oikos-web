'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Calendar, AlertTriangle, Loader2, Pencil, CheckCircle2, Archive,
  Trash2, Check, Circle, Plus, Link2, Unlink, Award, Printer, Library, Play,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../../../../../lib/navigation';
import { useParams } from 'next/navigation';

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

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
}

interface MilestoneCompletion {
  id: string;
  milestone_id: string;
  child_id: string;
  completed_at: string;
  notes: string | null;
}

interface Project {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  completed_at: string | null;
  children: ProjectChild[];
  subjects: ProjectSubject[];
  milestones: Milestone[];
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

interface PortfolioEntry {
  id: string;
  project_id: string;
  child_id: string;
  title: string;
  reflection: string | null;
  parent_notes: string | null;
  score: number | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

interface Achievement {
  id: string;
  child_id: string;
  project_id: string;
  awarded_at: string;
  certificate_number: string;
  acknowledged_at: string | null;
}

interface ProjectResource {
  project_id: string;
  resource_id: string;
  added_at: string;
  notes: string | null;
}

interface Resource {
  id: string;
  title: string;
  type: string;
  author: string | null;
  url: string | null;
}

export default function ProjectDetailPage() {
  const t = useTranslations('Projects');
  const tResources = useTranslations('Resources');
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [completions, setCompletions] = useState<MilestoneCompletion[]>([]);
  const [portfolioEntries, setPortfolioEntries] = useState<PortfolioEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'resources' | 'portfolio'>('overview');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/v1/projects/${projectId}`, { credentials: 'include' });
    if (res.ok) {
      const p = await res.json();
      setProject(p);
      setCompletions(p.completions || []);
      return p;
    }
    return null;
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const [, childRes, subjRes] = await Promise.all([
        loadProject(),
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
      ]);
      if (childRes.ok) setChildren(await childRes.json());
      if (subjRes.ok) setSubjects(await subjRes.json());

      setIsLoading(false);
    }
    init();
  }, [projectId, loadProject]);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === 'portfolio' && project?.status === 'complete') {
      loadPortfolio();
      loadAchievements();
    }
    if (activeTab === 'resources') {
      loadProjectResources();
      loadAllResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, project?.status]);

  async function loadPortfolio() {
    const res = await fetch(`/api/v1/projects/${projectId}/portfolio`, { credentials: 'include' });
    if (res.ok) setPortfolioEntries(await res.json());
  }

  async function loadAchievements() {
    if (!project) return;
    const achPromises = project.children.map((pc) =>
      fetch(`/api/v1/projects/achievements/child/${pc.child_id}`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : []
      )
    );
    const results = await Promise.all(achPromises);
    const all = results.flat().filter((a: Achievement) => a.project_id === projectId);
    setAchievements(all);
  }

  async function loadProjectResources() {
    const res = await fetch(`/api/v1/projects/${projectId}/resources`, { credentials: 'include' });
    if (res.ok) setProjectResources(await res.json());
  }

  async function loadAllResources() {
    const res = await fetch('/api/v1/resources', { credentials: 'include' });
    if (res.ok) setAllResources(await res.json());
  }

  async function handleComplete() {
    const res = await fetch(`/api/v1/projects/${projectId}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
      setShowCompleteModal(false);
      setShowCelebration(true);
    }
  }

  async function handleActivate() {
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
    setShowActivateModal(false);
  }

  async function handleArchive() {
    const res = await fetch(`/api/v1/projects/${projectId}/archive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      router.push('/projects');
    }
    setShowArchiveModal(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      router.push('/projects');
    }
    setShowDeleteModal(false);
  }

  async function toggleMilestone(milestoneId: string, childId: string) {
    const res = await fetch(`/api/v1/projects/milestones/${milestoneId}/toggle/${childId}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.completed) {
        setCompletions((prev) => [...prev, data.completion]);
      } else {
        setCompletions((prev) =>
          prev.filter((c) => !(c.milestone_id === milestoneId && c.child_id === childId))
        );
      }
    }
  }

  async function addMilestone() {
    if (!newMilestoneTitle.trim()) return;
    const sortOrder = project?.milestones?.length || 0;
    const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: newMilestoneTitle.trim(), sort_order: sortOrder }),
    });
    if (res.ok) {
      setNewMilestoneTitle('');
      await loadProject();
    }
  }

  async function deleteMilestone(milestoneId: string) {
    const res = await fetch(`/api/v1/projects/milestones/${milestoneId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) await loadProject();
  }

  async function linkResource(resourceId: string) {
    const res = await fetch(`/api/v1/projects/${projectId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resource_id: resourceId }),
    });
    if (res.ok) loadProjectResources();
  }

  async function unlinkResource(resourceId: string) {
    const res = await fetch(`/api/v1/projects/${projectId}/resources/${resourceId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) loadProjectResources();
  }

  async function savePortfolioEntry(entryId: string, data: Partial<PortfolioEntry>) {
    const res = await fetch(`/api/v1/projects/portfolio/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.ok) loadPortfolio();
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
    return subjects.find((s) => s.id === subjectId)?.name || '';
  }

  function getSubjectColor(subjectId: string): string {
    return subjects.find((s) => s.id === subjectId)?.color || '#6366F1';
  }

  function isMilestoneCompleted(milestoneId: string, childId: string): boolean {
    return completions.some((c) => c.milestone_id === milestoneId && c.child_id === childId);
  }

  function isOverdue(): boolean {
    if (!project?.due_date) return false;
    if (project.status === 'complete' || project.status === 'archived') return false;
    return new Date(project.due_date) < new Date();
  }

  function getIncompleteMilestones(): Milestone[] {
    if (!project) return [];
    return project.milestones.filter((m) => {
      return project.children.some((pc) => !isMilestoneCompleted(m.id, pc.child_id));
    });
  }

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    active: 'bg-primary/10 text-primary',
    complete: 'bg-green-100 text-green-700',
    archived: 'bg-slate-100 text-slate-500',
  };

  const tabs = [
    { key: 'overview' as const, label: t('tabOverview') },
    { key: 'milestones' as const, label: t('tabMilestones') },
    { key: 'resources' as const, label: t('tabResources') },
    { key: 'portfolio' as const, label: t('tabPortfolio') },
  ];

  const linkedResourceIds = new Set(projectResources.map((pr) => pr.resource_id));
  const availableResources = allResources.filter((r) => !linkedResourceIds.has(r.id));

  return (
    <div className="max-w-5xl">
      {/* Back link */}
      <button
        onClick={() => router.push('/projects')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('title')}
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{project.title}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                {t(`status${project.status.charAt(0).toUpperCase() + project.status.slice(1)}` as any)}
              </span>
            </div>
            {project.due_date && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${isOverdue() ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                {isOverdue() && <AlertTriangle className="w-3.5 h-3.5" />}
                <Calendar className="w-3.5 h-3.5" />
                {new Date(project.due_date).toLocaleDateString()}
                {isOverdue() && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">{t('overdue')}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {project.status !== 'archived' && project.status !== 'complete' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/projects/${projectId}/edit`)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                title={t('editDetails')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              {project.status === 'draft' && (
                <button
                  onClick={() => setShowActivateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
                >
                  <Play className="w-4 h-4" />
                  {t('activate')}
                </button>
              )}
              {project.status === 'active' && (
                <button
                  onClick={() => setShowCompleteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('markComplete')}
                </button>
              )}
              <button
                onClick={() => setShowArchiveModal(true)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                title={t('archive')}
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title={t('delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Children & Subjects */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {project.children.map((pc) => (
                <div
                  key={pc.child_id}
                  title={getChildName(pc.child_id)}
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center border-2 border-white"
                >
                  {getChildInitials(pc.child_id)}
                </div>
              ))}
            </div>
            <span className="text-sm text-slate-500">
              {project.children.map((pc) => getChildName(pc.child_id)).join(', ')}
            </span>
          </div>
          {project.subjects.length > 0 && (
            <div className="flex gap-1.5">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {(project.description || project.purpose) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              {project.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">{t('descriptionLabel')}</h3>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{project.description}</p>
                </div>
              )}
              {project.purpose && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">{t('purposeLabel')}</h3>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{project.purpose}</p>
                </div>
              )}
            </div>
          )}

          {/* Per-child progress */}
          {project.milestones.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('progress', { completed: '', total: '' }).replace(' of ', '')} </h3>
              <div className="space-y-3">
                {project.children.map((pc) => {
                  const completed = completions.filter((c) => c.child_id === pc.child_id).length;
                  const total = project.milestones.length;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <div key={pc.child_id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                        {getChildInitials(pc.child_id)}
                      </div>
                      <span className="text-sm text-slate-700 w-24 truncate">{getChildName(pc.child_id)}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-slate-500 w-20 text-right">
                        {t('progress', { completed: String(completed), total: String(total) })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {activeTab === 'milestones' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="space-y-3">
            {project.milestones.map((milestone) => (
              <div key={milestone.id} className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-800">{milestone.title}</h4>
                  {project.status !== 'complete' && project.status !== 'archived' && (
                    <button
                      onClick={() => deleteMilestone(milestone.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {milestone.description && (
                  <p className="text-xs text-slate-500 mb-2">{milestone.description}</p>
                )}
                {milestone.due_date && (
                  <p className="text-xs text-slate-400 mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {new Date(milestone.due_date).toLocaleDateString()}
                  </p>
                )}
                {/* Per-child completion toggles */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.children.map((pc) => {
                    const done = isMilestoneCompleted(milestone.id, pc.child_id);
                    return (
                      <button
                        key={pc.child_id}
                        onClick={() => toggleMilestone(milestone.id, pc.child_id)}
                        disabled={project.status === 'complete' || project.status === 'archived'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          done
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        } ${project.status === 'complete' || project.status === 'archived' ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {done ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3 opacity-40" />}
                        {getChildName(pc.child_id)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add milestone */}
          {project.status !== 'complete' && project.status !== 'archived' && (
            <div className="flex items-center gap-2 mt-4">
              <input
                type="text"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                placeholder={t('addMilestone')}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                onClick={addMilestone}
                disabled={!newMilestoneTitle.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {t('addMilestone')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          {/* Linked resources */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('linkedSubjects').replace('Subjects', 'Resources')}</h3>
            {projectResources.length > 0 ? (
              <div className="space-y-3">
                {projectResources.map((pr) => {
                  const resource = allResources.find((r) => r.id === pr.resource_id);
                  if (!resource) return null;
                  return (
                    <div key={pr.resource_id} className="border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-800">{resource.title}</h4>
                        {resource.author && <p className="text-xs text-slate-500">{resource.author}</p>}
                        {resource.url && (
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                            {resource.url}
                          </a>
                        )}
                        {pr.notes && <p className="text-xs text-slate-400 mt-1">{pr.notes}</p>}
                      </div>
                      {project.status !== 'complete' && project.status !== 'archived' && (
                        <button
                          onClick={() => unlinkResource(pr.resource_id)}
                          className="ml-3 p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title={t('unlinkResource')}
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-3">
                  <Library className="h-8 w-8 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">{t('resourcesEmptyTitle')}</h4>
                <p className="text-xs text-slate-500">{t('resourcesEmptyDescription')}</p>
              </div>
            )}
          </div>

          {/* Link new resources */}
          {project.status !== 'complete' && project.status !== 'archived' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">{t('availableResources')}</h3>
                <button
                  onClick={() => router.push('/resources')}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
                >
                  <Library className="w-3.5 h-3.5" />
                  {t('goToResourceLibrary')}
                </button>
              </div>

              {allResources.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-3">{t('noResourcesAvailable')}</p>
                  <button
                    onClick={() => router.push('/resources/new')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {tResources('newResource')}
                  </button>
                </div>
              ) : availableResources.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">All your resources are already linked.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {availableResources.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700">{r.title}</span>
                        {r.author && <span className="text-xs text-slate-400 ml-2">{r.author}</span>}
                      </div>
                      <button
                        onClick={() => linkResource(r.id)}
                        className="inline-flex items-center gap-1 ml-3 px-2.5 py-1 text-xs text-primary hover:bg-primary/5 rounded font-medium transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {t('linkResource')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {project.status !== 'complete' ? (
            <div className="text-center py-10">
              <p className="text-slate-500 text-sm">{t('noPortfolioEntries')}</p>
            </div>
          ) : (
            portfolioEntries.map((entry) => {
              const achievement = achievements.find(
                (a) => a.child_id === entry.child_id && a.project_id === projectId
              );
              return (
                <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                        {getChildInitials(entry.child_id)}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-800">{getChildName(entry.child_id)}</h3>
                        {achievement && (
                          <span className="text-xs text-slate-400">{achievement.certificate_number}</span>
                        )}
                      </div>
                    </div>
                    {achievement && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/projects/${projectId}/certificate/${entry.child_id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                        >
                          <Award className="w-4 h-4" />
                          {t('viewCertificate')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reflection */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('portfolioReflection')}</label>
                    <textarea
                      defaultValue={entry.reflection || ''}
                      placeholder={t('portfolioReflectionPlaceholder')}
                      onBlur={(e) => {
                        if (e.target.value !== (entry.reflection || '')) {
                          savePortfolioEntry(entry.id, { reflection: e.target.value || null });
                        }
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                  </div>

                  {/* Parent Notes */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('portfolioParentNotes')}</label>
                    <textarea
                      defaultValue={entry.parent_notes || ''}
                      placeholder={t('portfolioParentNotesPlaceholder')}
                      onBlur={(e) => {
                        if (e.target.value !== (entry.parent_notes || '')) {
                          savePortfolioEntry(entry.id, { parent_notes: e.target.value || null });
                        }
                      }}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                  </div>

                  {/* Score */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">{t('portfolioScore')}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{t('portfolioScoreNeedsGrowth')}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <button
                            key={n}
                            onClick={() => savePortfolioEntry(entry.id, { score: entry.score === n ? null : n })}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                              entry.score === n
                                ? 'bg-primary text-white'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">{t('portfolioScoreExceptional')}</span>
                    </div>
                    {entry.score === null && (
                      <p className="text-xs text-slate-400 mt-1">{t('portfolioScoreNone')}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowActivateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('activateConfirmTitle')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('activateConfirmMessage')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowActivateModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleActivate}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
              >
                {t('activateAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowCompleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('completeConfirmTitle')}</h3>
            <p className="text-sm text-slate-500 mb-3">{t('completeConfirmMessage')}</p>
            {getIncompleteMilestones().length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-amber-600 font-medium mb-1">{t('completeConfirmWarning')}</p>
                <ul className="list-disc list-inside text-sm text-slate-500">
                  {getIncompleteMilestones().map((m) => (
                    <li key={m.id}>{m.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                {t('completeAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowArchiveModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('archiveConfirmTitle')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('archiveConfirmMessage')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                {t('archiveAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('deleteConfirmTitle')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('deleteConfirmMessage')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A3828]/90">
          <div className="text-center max-w-lg mx-4">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-[#2D5F3E] bg-[#1A3828] flex items-center justify-center shadow-2xl">
                <Award className="w-12 h-12 text-[#C4A962]" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">{t('celebrationTitle')}</h2>
              <p className="text-lg text-green-200">{t('celebrationBadge')}</p>
            </div>

            <div className="space-y-4 mb-8">
              {project.children.map((pc) => (
                <div
                  key={pc.child_id}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
                >
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#C4A962]/20 text-[#C4A962] text-xl font-bold flex items-center justify-center border-2 border-[#C4A962]">
                    {getChildInitials(pc.child_id)}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{getChildName(pc.child_id)}</h3>
                  <p className="text-green-200 text-sm mt-1">{project.title}</p>
                  {project.completed_at && (
                    <p className="text-green-300/60 text-xs mt-1">
                      {new Date(project.completed_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                  {project.subjects.length > 0 && (
                    <div className="flex justify-center gap-2 mt-2">
                      {project.subjects.map((ps) => (
                        <span key={ps.subject_id} className="text-xs text-green-200/80">
                          {getSubjectName(ps.subject_id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowCelebration(false);
                setActiveTab('portfolio');
                loadPortfolio();
                loadAchievements();
              }}
              className="px-8 py-3 bg-white text-[#1A3828] rounded-xl font-semibold text-sm hover:bg-green-50 transition-colors"
            >
              {t('celebrationDone')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
