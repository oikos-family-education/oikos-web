'use client';

import { apiFetch } from '../lib/apiFetch';
import { useCallback, useEffect, useState } from 'react';

export interface ChecklistRow {
  /** Stable key for React. */
  key: string;
  subjectId: string;
  subjectName: string;
  color: string;
  /** Default minutes to record when a tick creates a log for this row. */
  durationMinutes: number;
  children: { id: string; name: string }[];
  /** Where this row was sourced from — drives the optional UI tag. */
  source: 'planner' | 'curriculum';
  /** For planner rows only: minute-of-day. Lets callers sort or label by time. */
  startMinute?: number;
}

interface PlannerEntry {
  id: string;
  subject_id: string | null;
  subject_name: string | null;
  is_free_time: boolean;
  child_ids: string[];
  child_names: string[];
  start_minute: number;
  duration_minutes: number;
  color: string | null;
}

interface EnrollmentRow {
  subject_id: string;
  subject_name: string;
  color: string | null;
  duration_minutes: number;
  child_ids: string[];
  child_names: string[];
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the (subject × children) rows to render in the day-log checklist
 * for a given date.
 *
 * For TODAY we use the live week planner — the rows mirror what the user
 * sees on the dashboard, with time-of-day context preserved.
 *
 * For ANY OTHER DATE we use curriculum enrollment as the source of truth.
 * The week planner has no history; projecting today's schedule onto a past
 * date would silently lie about what was actually scheduled (planners get
 * edited, templates get swapped). Curricula carry start/end dates, so
 * "which (child, subject) pairs were enrolled on date D" is a question we
 * can answer honestly.
 */
export function useDayRows(date: string) {
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const todayIso = isoToday();
      const isToday = date === todayIso;

      if (isToday) {
        const res = await apiFetch('/api/v1/week-planner/today', {
          credentials: 'include',
        });
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = (await res.json()) as PlannerEntry[];
        const mapped: ChecklistRow[] = (Array.isArray(data) ? data : [])
          .filter((r) => !r.is_free_time && r.subject_id && r.child_ids.length > 0)
          .map((r) => ({
            key: `planner-${r.id}`,
            subjectId: r.subject_id as string,
            subjectName: r.subject_name ?? '',
            color: r.color || '#6366f1',
            durationMinutes: r.duration_minutes,
            children: r.child_ids.map((id, idx) => ({
              id,
              name: r.child_names[idx] ?? '',
            })),
            source: 'planner' as const,
            startMinute: r.start_minute,
          }))
          .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
        setRows(mapped);
        return;
      }

      const res = await apiFetch(
        `/api/v1/curriculums/enrollments?date=${date}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = (await res.json()) as EnrollmentRow[];
      const mapped: ChecklistRow[] = (Array.isArray(data) ? data : []).map((r) => ({
        key: `curriculum-${r.subject_id}`,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        color: r.color || '#6366f1',
        durationMinutes: r.duration_minutes,
        children: r.child_ids.map((id, idx) => ({
          id,
          name: r.child_names[idx] ?? '',
        })),
        source: 'curriculum',
      }));
      setRows(mapped);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, refetch: load };
}
