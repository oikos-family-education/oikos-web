export interface RoutineEntryData {
  id: string;
  template_id: string;
  family_id: string;
  subject_id: string | null;
  is_free_time: boolean;
  child_ids: string[];
  day_of_week: number; // 0=Monday .. 6=Sunday
  start_minute: number; // minutes from midnight
  duration_minutes: number;
  priority: 'high' | 'medium' | 'low';
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeekTemplateData {
  id: string;
  family_id: string;
  name: string;
  is_active: boolean;
  entries: RoutineEntryData[];
  created_at: string;
  updated_at: string;
}

export interface WeekTemplateSummary {
  id: string;
  family_id: string;
  name: string;
  is_active: boolean;
  entry_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectData {
  id: string;
  name: string;
  short_description: string | null;
  icon: string | null;
  color: string;
  priority: number; // 1=High, 2=Medium, 3=Low
  default_session_duration_minutes: number;
}

export interface ChildData {
  id: string;
  name: string;
  nickname: string | null;
  birthdate: string | null;
  birth_year: number | null;
  birth_month: number | null;
  grade_level: number | null;
  is_active: boolean;
}

export interface CurriculumData {
  id: string;
  name: string;
  status: string;
  child_curriculums: { child_id: string; curriculum_id: string }[];
  curriculum_subjects: { subject_id: string; is_active: boolean }[];
}

export interface DragSubjectPayload {
  type: 'subject';
  subjectId: string;
  childIds: string[];
  isFreeTime: boolean;
  color: string;
  priority: 'high' | 'medium' | 'low';
  durationMinutes: number;
  subjectName: string;
  icon: string | null;
}

export const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export const DAY_SHORTS = ['monShort', 'tueShort', 'wedShort', 'thuShort', 'friShort', 'satShort', 'sunShort'] as const;

export const HOURS_START = 6;
export const HOURS_END = 22;
export const HOUR_COUNT = HOURS_END - HOURS_START + 1; // 17 hours (06:00-22:00)
export const ROW_HEIGHT = 64; // px per hour row
export const MIN_DURATION = 15;
export const MAX_DURATION = 300;

export function minuteToTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseTime(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function priorityFromNumber(n: number): 'high' | 'medium' | 'low' {
  if (n === 1) return 'high';
  if (n === 3) return 'low';
  return 'medium';
}

export function priorityColor(p: 'high' | 'medium' | 'low'): string {
  if (p === 'high') return 'bg-red-500';
  if (p === 'low') return 'bg-green-500';
  return 'bg-amber-400';
}

// Custom activity helpers — entries with subject_id=null and is_free_time=false
// Notes field stores: line 0 = icon emoji, line 1 = name, lines 2+ = user notes
export function isCustomActivity(entry: RoutineEntryData): boolean {
  return !entry.is_free_time && !entry.subject_id;
}

export function encodeCustomNotes(icon: string, name: string, userNotes?: string): string {
  const lines = [icon, name];
  if (userNotes) lines.push(userNotes);
  return lines.join('\n');
}

export function parseCustomNotes(notes: string | null): { icon: string; name: string; userNotes: string } {
  if (!notes) return { icon: '✏️', name: 'Custom Activity', userNotes: '' };
  const lines = notes.split('\n');
  if (lines.length >= 2) {
    return { icon: lines[0], name: lines[1], userNotes: lines.slice(2).join('\n') };
  }
  return { icon: '✏️', name: lines[0], userNotes: '' };
}

export const CUSTOM_ICONS = ['✏️', '🎨', '🎵', '📖', '🧩', '🏃', '🧪', '🌍', '💡', '🎭', '🔧', '🎯'] as const;

export const CUSTOM_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6B7280', '#78716C',
] as const;
