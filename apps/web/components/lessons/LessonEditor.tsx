'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, BookOpen, Calendar as CalendarIcon, CheckCircle2,
  Clock, Copy, Heading1, Image as ImageIcon, Link2, ListChecks,
  Minus, MessageSquare, Plus, Save, Trash2, Type, Video,
} from 'lucide-react';
import { Button } from '@oikos/ui';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useRouter } from '../../lib/navigation';
import {
  LESSON_BLOCK_TYPES, todayISO,
  type LessonBlock, type LessonBlockType, type LessonDetail, type LessonStatus,
} from '../../lib/lessonUtils';
import { LessonStatusBadge } from './LessonStatusBadge';
import { LessonBlockEditor } from './LessonBlockEditor';

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

const BLOCK_PICKER: Array<{
  type: LessonBlockType;
  icon: React.ReactNode;
  labelKey: string;
  defaultContent: Record<string, unknown>;
}> = [
  { type: 'text',         icon: <Type className="w-4 h-4" />,         labelKey: 'blockText',        defaultContent: { html: '' } },
  { type: 'heading',      icon: <Heading1 className="w-4 h-4" />,     labelKey: 'blockHeading',     defaultContent: { level: 2, text: '' } },
  { type: 'link',         icon: <Link2 className="w-4 h-4" />,        labelKey: 'blockLink',        defaultContent: { url: '' } },
  { type: 'checklist',    icon: <ListChecks className="w-4 h-4" />,   labelKey: 'blockChecklist',   defaultContent: { items: [] } },
  { type: 'image_url',    icon: <ImageIcon className="w-4 h-4" />,    labelKey: 'blockImageUrl',    defaultContent: { url: '' } },
  { type: 'video_embed',  icon: <Video className="w-4 h-4" />,        labelKey: 'blockVideoEmbed',  defaultContent: { url: '' } },
  { type: 'callout',      icon: <MessageSquare className="w-4 h-4" />, labelKey: 'blockCallout',     defaultContent: { icon: '💡', text: '', color: 'blue' } },
  { type: 'divider',      icon: <Minus className="w-4 h-4" />,         labelKey: 'blockDivider',     defaultContent: {} },
];

export function LessonEditor({ lessonId, defaultDateISO }: LessonEditorProps) {
  const t = useTranslations('Lessons');
  const router = useRouter();
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
  const [draftObjectives, setDraftObjectives] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);

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

  async function handleDelete() {
    if (!lesson) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    const res = await fetch(`/api/v1/lessons/${lesson.id}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) router.push('/lessons');
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

  // ── Block mutations ───────────────────────────────────────────────────

  async function addBlock(type: LessonBlockType) {
    if (!lesson) return;
    const def = BLOCK_PICKER.find((b) => b.type === type);
    if (!def) return;
    const res = await fetch(`/api/v1/lessons/${lesson.id}/blocks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content: def.defaultContent }),
    });
    if (res.ok) {
      const created: LessonBlock = await res.json();
      setLesson({ ...lesson, blocks: [...lesson.blocks, created] });
    }
  }

  async function patchBlock(blockId: string, content: Record<string, unknown>) {
    if (!lesson) return;
    setLesson({
      ...lesson,
      blocks: lesson.blocks.map((b) => (b.id === blockId ? { ...b, content } : b)),
    });
    await fetch(`/api/v1/lessons/${lesson.id}/blocks/${blockId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }

  async function deleteBlock(blockId: string) {
    if (!lesson) return;
    setLesson({ ...lesson, blocks: lesson.blocks.filter((b) => b.id !== blockId) });
    await fetch(`/api/v1/lessons/${lesson.id}/blocks/${blockId}`, {
      method: 'DELETE', credentials: 'include',
    });
  }

  async function duplicateBlock(blockId: string) {
    if (!lesson) return;
    const original = lesson.blocks.find((b) => b.id === blockId);
    if (!original) return;
    const res = await fetch(`/api/v1/lessons/${lesson.id}/blocks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: original.type, content: original.content }),
    });
    if (res.ok) {
      const created: LessonBlock = await res.json();
      setLesson({ ...lesson, blocks: [...lesson.blocks, created] });
    }
  }

  async function reorderBlocks(newOrder: string[]) {
    if (!lesson) return;
    const lookup = new Map(lesson.blocks.map((b) => [b.id, b]));
    setLesson({
      ...lesson,
      blocks: newOrder.map((id, idx) => ({ ...(lookup.get(id) as LessonBlock), sort_order: idx })),
    });
    await fetch(`/api/v1/lessons/${lesson.id}/blocks/reorder`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder }),
    });
  }

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

  return (
    <div className="max-w-6xl">
      <BackLink />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{lesson.title}</h1>
            <LessonStatusBadge status={lesson.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {lesson.subject.name} · <CalendarIcon className="inline w-3 h-3" /> {lesson.scheduled_for}
            {lesson.estimated_duration_minutes
              ? <> · <Clock className="inline w-3 h-3" /> {lesson.estimated_duration_minutes} min</>
              : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lesson.status !== 'completed' && lesson.status !== 'cancelled' && (
            <Button onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> {t('markComplete')}
            </Button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            aria-label={t('delete')}
            className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar — metadata */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <SidebarField label={t('lessonTitle')}>
              <input
                type="text"
                defaultValue={lesson.title}
                onBlur={(e) => patchLesson({ title: e.target.value })}
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

        {/* Main — block editor */}
        <main className="lg:col-span-8">
          <BlockListEditor
            blocks={lesson.blocks}
            onAdd={addBlock}
            onPatch={patchBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onReorder={reorderBlocks}
          />
          <div className="mt-3 flex justify-end">
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
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/lessons"
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

// ── Block list with DnD ────────────────────────────────────────────────────

function BlockListEditor({
  blocks, onAdd, onPatch, onDelete, onDuplicate, onReorder,
}: {
  blocks: LessonBlock[];
  onAdd: (type: LessonBlockType) => void;
  onPatch: (id: string, content: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (newOrder: string[]) => void;
}) {
  const t = useTranslations('Lessons');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => blocks.map((b) => b.id), [blocks]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                onPatch={(content) => onPatch(block.id, content)}
                onDelete={() => onDelete(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/50 p-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">{t('addBlock')}</p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_PICKER.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => onAdd(b.type)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-primary/40 hover:text-primary"
            >
              {b.icon}
              {t(b.labelKey as never)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableBlock({
  block, onPatch, onDelete, onDuplicate,
}: {
  block: LessonBlock;
  onPatch: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <LessonBlockEditor
        block={block}
        onChange={onPatch}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
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
