export type EventType = 'family' | 'subject' | 'project' | 'curriculum';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly';
export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  family_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  all_day: boolean;
  start_at: string;
  end_at: string;
  child_ids: string[];
  subject_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  color: string | null;
  location: string | null;
  recurrence: Recurrence;
  is_system: boolean;
  source_url: string | null;
}

export interface RoutineProjectionBlock {
  entry_id: string;
  date: string;
  day_of_week: number;
  start_minute: number;
  duration_minutes: number;
  subject_id: string | null;
  subject_name: string | null;
  is_free_time: boolean;
  child_ids: string[];
  color: string | null;
  notes: string | null;
}

export interface CalendarChild {
  id: string;
  first_name: string;
  nickname: string | null;
  avatar_initials: string | null;
}

export interface CalendarSubject {
  id: string;
  name: string;
  color: string;
}

export interface CalendarProject {
  id: string;
  title: string;
  milestones?: CalendarMilestone[];
}

export interface CalendarMilestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
}

export const EVENT_TYPE_COLORS: Record<EventType | 'system', string> = {
  family: '#6366f1',
  subject: '#f59e0b',
  project: '#10b981',
  curriculum: '#64748b',
  system: '#64748b',
};

export const COLOR_PRESETS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#0ea5e9',
];

export const HOURS_START = 6;
export const HOURS_END = 22;
export const ROW_HEIGHT = 56;

export function getEventColor(event: CalendarEvent): string {
  if (event.is_system) return EVENT_TYPE_COLORS.system;
  if (event.color) return event.color;
  return EVENT_TYPE_COLORS[event.event_type];
}

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

// Returns date as YYYY-MM-DD in local time
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Week starts on Monday. Returns date for Monday of the week containing `date`.
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Build month grid: 6 weeks × 7 days, aligned to Monday
export function buildMonthGrid(date: Date): Date[] {
  const first = startOfMonth(date);
  const gridStart = startOfWeek(first);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

export function buildWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Parse an ISO date string from the server (always UTC) into a local Date that
// represents the same calendar day and wall-clock time. Works for all-day and timed.
export function parseServerDate(iso: string): Date {
  return new Date(iso);
}

// Is `day` within the [start, end] date range (day-granularity)?
export function dayInEventRange(day: Date, event: CalendarEvent): boolean {
  const start = parseServerDate(event.start_at);
  const end = parseServerDate(event.end_at);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return end >= dayStart && start <= dayEnd;
}
