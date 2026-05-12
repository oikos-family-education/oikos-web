/**
 * Lesson planner — pure utility helpers (no React, no fetch).
 *
 * A Lesson is anchored to a Subject. Children, curricula, and projects related
 * to a lesson are derived through `lesson.subject.{child_ids,curriculum_ids,project_ids}`
 * — never stored on the lesson itself.
 */

export type LessonStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const LESSON_STATUSES: LessonStatus[] = [
  'draft', 'scheduled', 'in_progress', 'completed', 'cancelled',
];

export interface SubjectMinimal {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  curriculum_ids: string[];
  child_ids: string[];
  project_ids: string[];
}

export interface LessonSummary {
  id: string;
  title: string;
  status: LessonStatus;
  scheduled_for: string;          // ISO yyyy-MM-dd
  estimated_duration_minutes: number | null;
  subject: SubjectMinimal;
  tags: string[];
}

export type LessonBlockType =
  | 'text'
  | 'heading'
  | 'link'
  | 'resource_ref'
  | 'checklist'
  | 'image_url'
  | 'video_embed'
  | 'divider'
  | 'callout';

export const LESSON_BLOCK_TYPES: LessonBlockType[] = [
  'text', 'heading', 'link', 'resource_ref', 'checklist',
  'image_url', 'video_embed', 'divider', 'callout',
];

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: LessonBlockType;
  content: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LessonDetail extends LessonSummary {
  objectives: string[];
  actual_duration_minutes: number | null;
  completion_notes: string | null;
  taught_on: string | null;
  blocks: LessonBlock[];
  family_id: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Status helpers ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LessonStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  scheduled: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-slate-100 text-slate-400 border-slate-200',
};

export function getLessonStatusColor(status: LessonStatus): string {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}

const ACTIONABLE: ReadonlySet<LessonStatus> = new Set([
  'draft', 'scheduled', 'in_progress',
]);

export function isLessonActionable(status: LessonStatus): boolean {
  return ACTIONABLE.has(status);
}

// ── Date / week grouping ──────────────────────────────────────────────────

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeekISO(iso: string = todayISO()): string {
  const d = new Date(iso + 'T00:00:00');
  // Monday-based week: dayOfWeek=0 means Sunday → 6 days back; 1 means Monday → 0 back, etc.
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Group lessons by their `scheduled_for` ISO date. */
export function groupLessonsByDate(
  lessons: LessonSummary[],
): Record<string, LessonSummary[]> {
  const out: Record<string, LessonSummary[]> = {};
  for (const lesson of lessons) {
    const key = lesson.scheduled_for;
    if (!out[key]) out[key] = [];
    out[key].push(lesson);
  }
  // Stable sort within each day by title.
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => a.title.localeCompare(b.title));
  }
  return out;
}

export interface WeekDay {
  date: string;             // ISO yyyy-MM-dd
  lessons: LessonSummary[];
}

/**
 * Build a 7-day array starting at `weekStartISO`, attaching the matching
 * lessons from `grouped` to each day. Days with no lessons get an empty array.
 */
export function buildLessonWeekDays(
  weekStartISO: string,
  grouped: Record<string, LessonSummary[]>,
): WeekDay[] {
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStartISO, i);
    days.push({ date, lessons: grouped[date] || [] });
  }
  return days;
}

// ── Formatting helpers ────────────────────────────────────────────────────

export function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '';
  return `${minutes} min`;
}

export function formatLessonDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
