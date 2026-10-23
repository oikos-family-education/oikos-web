export type HighlightCategory = 'social' | 'book' | 'documentary' | 'outdoor' | 'other';

export const HIGHLIGHT_CATEGORIES: HighlightCategory[] = ['social', 'book', 'documentary', 'outdoor', 'other'];

export interface Highlight {
  id: string;
  child_id: string;
  category: HighlightCategory;
  title: string;
  description: string | null;
  occurred_on: string | null; // YYYY-MM-DD; null for recurring things with no single date
  created_at: string;
  updated_at: string;
}

export interface ReportResource {
  id: string;
  title: string;
  type: string;
  author: string | null;
  progress_notes: string | null;
}

export interface ReportSubject {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  category: string;
  short_description: string | null;
  learning_objectives: string[];
  skills_targeted: string[];
  weekly_frequency: number;
  session_duration_minutes: number;
  scheduled_days: number[];
  goals_for_period: string[];
  notes: string | null;
  taught_by: string | null;
  resources: ReportResource[];
  sessions_logged: number;
  minutes_logged: number;
}

export interface ReportCurriculum {
  id: string;
  name: string;
  description: string | null;
  period_type: string;
  start_date: string;
  end_date: string;
  education_philosophy: string | null;
  overall_goals: string[];
  subjects: ReportSubject[];
}

export interface ReportProject {
  id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  subject_names: string[];
  milestones_total: number;
  milestones_completed: number;
  portfolio: {
    title: string;
    reflection: string | null;
    parent_notes: string | null;
    score: number | null;
  } | null;
}

export interface ReportRoutineEntry {
  day_of_week: number;
  start_minute: number;
  duration_minutes: number;
  subject_id: string | null;
  subject_name: string | null;
  icon: string | null;
  color: string | null;
  is_free_time: boolean;
  notes: string | null;
}

export interface ChildReport {
  generated_at: string;
  range: { from_date: string; to_date: string };
  family: { family_name: string; shield_config: Record<string, unknown> | null };
  child: {
    id: string;
    first_name: string;
    nickname: string | null;
    birthdate: string | null;
    birth_year: number | null;
    birth_month: number | null;
    grade_level: string | null;
    learning_styles: string[];
    interests: string[];
    personality_description: string | null;
    personality_tags: string[];
    motivators: string | null;
    learning_differences: string[];
    accommodations_notes: string | null;
  };
  curriculums: ReportCurriculum[];
  projects: ReportProject[];
  routine: {
    template_name: string;
    include_saturday: boolean;
    include_sunday: boolean;
    entries: ReportRoutineEntry[];
  } | null;
  notes: { id: string; title: string | null; content: string; tags: string[]; is_pinned: boolean; created_at: string }[];
  highlights: Highlight[];
  learning_summary: { total_sessions: number; total_minutes: number; days_with_sessions: number };
}

export type ReportSection =
  | 'profile'
  | 'support'
  | 'summary'
  | 'curriculum'
  | 'projects'
  | 'routine'
  | 'highlights'
  | 'notes';

export const REPORT_SECTIONS: ReportSection[] = [
  'profile', 'support', 'summary', 'curriculum', 'projects', 'routine', 'highlights', 'notes',
];

// Learning needs can be sensitive on a shared printout, so they start excluded
export const DEFAULT_SECTIONS: ReportSection[] = REPORT_SECTIONS.filter((s) => s !== 'support');

/** Parse a YYYY-MM-DD date as a local date (avoids the UTC shift of `new Date('YYYY-MM-DD')`). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
