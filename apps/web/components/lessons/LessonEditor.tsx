'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import React from 'react';
import {
  AlertTriangle, ArrowLeft, BookOpen, Calendar as CalendarIcon, CheckCircle2,
  ChevronDown, Clock, Hash, Printer, Save, Trash2, icons as lucideIcons,
} from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link, useRouter } from '../../lib/navigation';
import {
  formatLessonIdentifier, todayISO,
  type LessonDetail, type LessonStatus,
} from '../../lib/lessonUtils';
import { useAuth } from '../../providers/AuthProvider';
import { LessonStatusBadge } from './LessonStatusBadge';
import { RichTextEditor } from './RichTextEditor';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface SubjectOption {
  id: string;
  name: string;
  color: string | null;
}

interface ChildOption { id: string; first_name: string; nickname: string | null }
interface CurriculumOption { id: string; name: string }
interface ProjectOption { id: string; title: string }

interface LessonEditorProps {
  /** When null, this is the create page. */
  lessonId: string | null;
  /** Used as the initial scheduled_for date when creating. */
  defaultDateISO?: string;
}

// Status transitions exposed in the header dropdown. Mirrors the server's
// _ALLOWED_TRANSITIONS map but excludes self-transitions and `completed`
// (handled by the dedicated CompletionDialog).
const STATUS_ACTIONS: Record<LessonStatus, LessonStatus[]> = {
  draft:       ['scheduled', 'in_progress', 'cancelled'],
  scheduled:   ['in_progress', 'draft', 'cancelled'],
  in_progress: ['scheduled', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const STATUS_ACTION_KEY: Record<LessonStatus, string> = {
  draft:       'statusActionDraft',
  scheduled:   'statusActionScheduled',
  in_progress: 'statusActionInProgress',
  completed:   'statusCompleted',
  cancelled:   'statusActionCancelled',
};

export function LessonEditor({ lessonId, defaultDateISO }: LessonEditorProps) {
  const t = useTranslations('Lessons');
  const router = useRouter();
  const { family } = useAuth();
  const isNew = lessonId === null;

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [curriculums, setCurriculums] = useState<CurriculumOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Form state for new lessons (before first save).
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubjectId, setDraftSubjectId] = useState('');
  const [draftScheduledFor, setDraftScheduledFor] = useState(defaultDateISO || todayISO());
  const [draftDuration, setDraftDuration] = useState<number | ''>('');
  const [draftReference, setDraftReference] = useState('');
  const [draftObjectives, setDraftObjectives] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // ── Initial loads ────────────────────────────────────────────────────

  const loadLesson = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}`, { credentials: 'include' });
      if (!res.ok) {
        setError(t('loadError'));
        setLoading(false);
        return;
      }
      const data: LessonDetail = await res.json();
      setLesson(data);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [lessonId, t]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/subjects?source=mine', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setSubjects(items.map((s: SubjectOption) => ({ id: s.id, name: s.name, color: s.color })));
      }
    } catch { /* ignore */ }
  }, []);

  const loadRelations = useCallback(async () => {
    try {
      const [c, cu, p] = await Promise.all([
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/curriculums', { credentials: 'include' }),
        fetch('/api/v1/projects', { credentials: 'include' }),
      ]);
      if (c.ok) setChildren(await c.json());
      if (cu.ok) {
        const data = await cu.json();
        setCurriculums(Array.isArray(data) ? data : data.items || []);
      }
      if (p.ok) {
        const data = await p.json();
        setProjects(Array.isArray(data) ? data : data.items || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadLesson(); }, [loadLesson]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => { loadRelations(); }, [loadRelations]);

  // ── Save / metadata mutations ─────────────────────────────────────────

  async function handleCreate() {
    if (!draftTitle.trim() || !draftSubjectId) {
      setError(t('saveError'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/lessons', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          subject_id: draftSubjectId,
          scheduled_for: draftScheduledFor,
          estimated_duration_minutes: draftDuration === '' ? null : Number(draftDuration),
          reference_number: draftReference.trim() || null,
          objectives: draftObjectives,
          tags: draftTags,
        }),
      });
      if (!res.ok) {
        setError(t('saveError'));
        setSaving(false);
        return;
      }
      const created: LessonDetail = await res.json();
      router.push(`/lessons/${created.id}`);
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function patchLesson(body: Partial<LessonDetail>) {
    if (!lesson) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/lessons/${lesson.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: LessonDetail = await res.json();
        setLesson(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!lesson) return;
    const res = await fetch(`/api/v1/lessons/${lesson.id}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) router.push('/lessons');
  }

  function handlePrint() {
    // Toggle a body class that the print stylesheet keys off of; clean up
    // once the print dialog closes so the page renders normally again.
    document.body.classList.add('printing-lesson');
    const cleanup = () => {
      document.body.classList.remove('printing-lesson');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  async function handleStatusChange(
    status: LessonStatus,
    extras: Partial<{ actual_duration_minutes: number; completion_notes: string; create_teaching_log: boolean }> = {},
  ) {
    if (!lesson) return;
    const res = await fetch(`/api/v1/lessons/${lesson.id}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extras }),
    });
    if (res.ok) {
      const updated: LessonDetail = await res.json();
      setLesson(updated);
    }
  }

  // ── Rich-text content (debounced PATCH) ──────────────────────────────

  const contentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleContentChange(html: string) {
    if (!lesson) return;
    // Optimistic in-memory update so the editor stays responsive.
    setLesson({ ...lesson, content_html: html });
    if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
    contentSaveTimer.current = setTimeout(() => {
      patchLesson({ content_html: html });
    }, 600);
  }

  useEffect(() => () => {
    if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-1/3 bg-slate-100 rounded" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="max-w-3xl">
        <BackLink />
        <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('newLesson')}</h1>
        <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-6">
          <FieldRow label={t('lessonTitle')} required>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={t('lessonTitlePlaceholder')}
              className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            />
          </FieldRow>
          <FieldRow label={t('subject')} required>
            <select
              value={draftSubjectId}
              onChange={(e) => setDraftSubjectId(e.target.value)}
              className="w-full text-sm rounded border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:border-primary"
            >
              <option value="">{t('subjectPlaceholder')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label={t('scheduledFor')} required>
              <input
                type="date"
                value={draftScheduledFor}
                onChange={(e) => setDraftScheduledFor(e.target.value)}
                className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
              />
            </FieldRow>
            <FieldRow label={`${t('estimatedDuration')} (${t('estimatedDurationUnit')})`}>
              <input
                type="number"
                min={1}
                max={720}
                value={draftDuration}
                onChange={(e) => setDraftDuration(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
              />
            </FieldRow>
          </div>
          <FieldRow label={t('referenceNumber')}>
            <input
              type="text"
              value={draftReference}
              onChange={(e) => setDraftReference(e.target.value)}
              maxLength={64}
              placeholder={t('referenceNumberPlaceholder')}
              className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-slate-500">{t('referenceNumberHint')}</p>
          </FieldRow>
          <FieldRow label={t('objectives')}>
            <TagInput value={draftObjectives} onChange={setDraftObjectives} placeholder={t('objectivePlaceholder')} />
          </FieldRow>
          <FieldRow label={t('tags')}>
            <TagInput value={draftTags} onChange={setDraftTags} placeholder={t('tagPlaceholder')} />
          </FieldRow>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Link
              href="/lessons"
              className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {t('completionCancel')}
            </Link>
            <Button onClick={handleCreate} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const subjectColor = lesson.subject.color || '#6366f1';
  const subjectIcon = lesson.subject.icon;
  const identifier = formatLessonIdentifier(
    lesson.subject.name, lesson.sequence_number, lesson.reference_number,
  );
  const statusActions = STATUS_ACTIONS[lesson.status];
  const canComplete = lesson.status !== 'completed' && lesson.status !== 'cancelled';

  return (
    <div className="max-w-6xl">
      <BackLink />

      {/* Print-only header — Oikos brand on the left, family shield on the
          right. `hidden print:flex` keeps it off the screen view entirely. */}
      <div className="lesson-print-header hidden print:flex items-center justify-between mb-6 pb-4 border-b border-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">Oikos</p>
            <p className="text-xs text-slate-500 mt-1">Family Education Platform</p>
          </div>
        </div>
        {family?.shield_config ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{family.family_name}</p>
            </div>
            <ShieldPreview
              config={family.shield_config as unknown as ShieldConfig}
              familyName={family.family_name}
              width={56}
              height={56}
              showMotto={false}
            />
          </div>
        ) : null}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          {/* Subject pill — colored by subject, links to the subject detail page */}
          <Link
            href={`/subjects/${lesson.subject.id}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-2 hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: `${subjectColor}1a`,
              color: subjectColor,
              borderColor: `${subjectColor}33`,
            }}
            aria-label={`${t('subject')}: ${lesson.subject.name}`}
          >
            <SubjectIcon name={subjectIcon} />
            {lesson.subject.name}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{lesson.title}</h1>
            <span data-print-hide>
              <LessonStatusBadge status={lesson.status} />
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
              <Hash className="w-3 h-3" aria-hidden /> {identifier}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" aria-hidden /> {lesson.scheduled_for}
            </span>
            {lesson.estimated_duration_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden /> {lesson.estimated_duration_minutes} min
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2" data-print-hide>
          {statusActions.length > 0 && (
            <StatusMenu
              open={showStatusMenu}
              onOpenChange={setShowStatusMenu}
              actions={statusActions}
              onSelect={(s) => { setShowStatusMenu(false); handleStatusChange(s); }}
            />
          )}
          {canComplete && (
            <Button onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> {t('markComplete')}
            </Button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            aria-label={t('printLesson')}
            title={t('printLesson')}
            className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            aria-label={t('delete')}
            className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar — metadata */}
        <aside className="lg:col-span-4 space-y-4" data-print-hide>
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <SidebarField label={t('lessonTitle')}>
              <input
                type="text"
                defaultValue={lesson.title}
                onBlur={(e) => patchLesson({ title: e.target.value })}
                className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
              />
            </SidebarField>
            <SidebarField label={t('referenceNumber')}>
              <input
                type="text"
                defaultValue={lesson.reference_number ?? ''}
                maxLength={64}
                placeholder={t('referenceNumberPlaceholder')}
                onBlur={(e) => patchLesson({
                  reference_number: e.target.value.trim() || null,
                })}
                className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
              />
            </SidebarField>
            <SidebarField label={t('scheduledFor')}>
              <input
                type="date"
                defaultValue={lesson.scheduled_for}
                onBlur={(e) => patchLesson({ scheduled_for: e.target.value as never })}
                className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
              />
            </SidebarField>
            <SidebarField label={`${t('estimatedDuration')} (${t('estimatedDurationUnit')})`}>
              <input
                type="number"
                min={1} max={720}
                defaultValue={lesson.estimated_duration_minutes ?? ''}
                onBlur={(e) => patchLesson({
                  estimated_duration_minutes: e.target.value === '' ? null : Number(e.target.value),
                })}
                className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
              />
            </SidebarField>
            <SidebarField label={t('objectives')}>
              <TagInput
                value={lesson.objectives}
                onChange={(v) => patchLesson({ objectives: v })}
                placeholder={t('objectivePlaceholder')}
              />
            </SidebarField>
            <SidebarField label={t('tags')}>
              <TagInput
                value={lesson.tags}
                onChange={(v) => patchLesson({ tags: v })}
                placeholder={t('tagPlaceholder')}
              />
            </SidebarField>
          </div>

          {/* Via Subject — read-only derived relations */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('viaSubject')}</h3>
            <DerivedList
              label={t('viaSubjectChildren')}
              ids={lesson.subject.child_ids}
              labelMap={Object.fromEntries(children.map((c) => [c.id, c.nickname || c.first_name]))}
            />
            <DerivedList
              label={t('viaSubjectCurricula')}
              ids={lesson.subject.curriculum_ids}
              labelMap={Object.fromEntries(curriculums.map((c) => [c.id, c.name]))}
            />
            <DerivedList
              label={t('viaSubjectProjects')}
              ids={lesson.subject.project_ids}
              labelMap={Object.fromEntries(projects.map((p) => [p.id, p.title]))}
            />
            {(lesson.subject.child_ids.length === 0
              && lesson.subject.curriculum_ids.length === 0
              && lesson.subject.project_ids.length === 0) ? (
              <p className="text-xs italic text-slate-400">{t('viaSubjectPlaceholder')}</p>
            ) : null}
          </div>
        </aside>

        {/* Main — rich text content */}
        <main className="lg:col-span-8 print:col-span-12">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3" data-print-hide>{t('content')}</p>
            <RichTextEditor
              value={lesson.content_html ?? ''}
              onChange={handleContentChange}
              placeholder={t('contentPlaceholder')}
            />
          </div>
          <div className="mt-3 flex justify-end" data-print-hide>
            <span className="text-[11px] text-slate-400">
              {saving ? t('saving') : t('saved')}
            </span>
          </div>
        </main>
      </div>

      {showCompleteDialog && (
        <CompletionDialog
          lesson={lesson}
          onClose={() => setShowCompleteDialog(false)}
          onSubmit={async (extras) => {
            await handleStatusChange('completed', extras);
            setShowCompleteDialog(false);
          }}
        />
      )}

      {showDeleteDialog && (
        <ConfirmDialog
          title={t('deleteDialogTitle')}
          body={t('deleteDialogBody', { title: lesson.title })}
          confirmLabel={t('deleteDialogConfirm')}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={async () => {
            setShowDeleteDialog(false);
            await confirmDelete();
          }}
        />
      )}
    </div>
  );
}

// ── Subject icon (resolves a lucide icon name from subject.icon) ──────────

function SubjectIcon({ name }: { name: string | null }) {
  // subject.icon stores a lucide-react icon name (e.g. "Calculator"). Look it
  // up dynamically; fall back to BookOpen for unknown / missing values.
  const key = name && name in lucideIcons ? (name as keyof typeof lucideIcons) : null;
  if (key) {
    return React.createElement(lucideIcons[key], {
      className: 'w-3.5 h-3.5',
      'aria-hidden': true,
    });
  }
  return <BookOpen className="w-3.5 h-3.5" aria-hidden />;
}

// ── Status menu (header dropdown) ──────────────────────────────────────────

function StatusMenu({
  open, onOpenChange, actions, onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: LessonStatus[];
  onSelect: (status: LessonStatus) => void;
}) {
  const t = useTranslations('Lessons');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {t('changeStatus')}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[14rem] rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        >
          {actions.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              onClick={() => onSelect(s)}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t(STATUS_ACTION_KEY[s] as never)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Themed confirm dialog (delete) ─────────────────────────────────────────

function ConfirmDialog({
  title, body, confirmLabel, onCancel, onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useTranslations('Lessons');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-red-50 text-red-600 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-600 mt-1">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {t('completionCancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/lessons"
      data-print-hide
      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary mb-4"
    >
      <ArrowLeft className="w-4 h-4" /> Lessons
    </Link>
  );
}

function FieldRow({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
      {children}
    </div>
  );
}

function TagInput({
  value, onChange, placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 focus-within:border-primary">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label="Remove"
            className="text-primary/60 hover:text-primary"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="flex-1 min-w-[6rem] text-xs bg-transparent focus:outline-none"
      />
    </div>
  );
}

function DerivedList({
  label, ids, labelMap,
}: {
  label: string;
  ids: string[];
  labelMap: Record<string, string>;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
            {labelMap[id] || id.slice(0, 8)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Completion dialog ──────────────────────────────────────────────────────

function CompletionDialog({
  lesson, onClose, onSubmit,
}: {
  lesson: LessonDetail;
  onClose: () => void;
  onSubmit: (extras: { actual_duration_minutes?: number; completion_notes?: string; create_teaching_log?: boolean }) => Promise<void>;
}) {
  const t = useTranslations('Lessons');
  const [duration, setDuration] = useState<number | ''>(lesson.estimated_duration_minutes ?? '');
  const [notes, setNotes] = useState('');
  const [createLog, setCreateLog] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('completionDialogTitle')}</h2>
        <div className="space-y-3">
          <FieldRow label={`${t('completionActualDuration')} (${t('estimatedDurationUnit')})`}>
            <input
              type="number"
              min={1} max={720}
              value={duration}
              onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            />
          </FieldRow>
          <FieldRow label={t('completionNotes')}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm rounded border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            />
          </FieldRow>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createLog}
              onChange={(e) => setCreateLog(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t('completionCreateLog')}
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {t('completionCancel')}
          </button>
          <Button onClick={() => onSubmit({
            actual_duration_minutes: duration === '' ? undefined : Number(duration),
            completion_notes: notes || undefined,
            create_teaching_log: createLog,
          })}>
            {t('completionSubmit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
