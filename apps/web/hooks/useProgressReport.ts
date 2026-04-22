'use client';

import { useEffect, useState } from 'react';

export interface ReportFamily {
  family_name: string;
  shield_config: Record<string, unknown> | null;
  location: string | null;
}

export interface ReportChild {
  id: string;
  first_name: string;
  grade_level: string | null;
  is_active: boolean;
}

export interface ReportCurriculumSubject {
  subject_id: string;
  name: string;
  color: string;
  weekly_frequency: number;
  goals_for_period: string[];
}

export interface ReportCurriculum {
  id: string;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  subjects: ReportCurriculumSubject[];
  enrolled_child_ids: string[];
}

export interface ReportMilestoneCompletion {
  child_id: string;
  completed_at: string;
}

export interface ReportMilestone {
  id: string;
  title: string;
  due_date: string | null;
  completions: ReportMilestoneCompletion[];
}

export interface ReportProject {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  child_ids: string[];
  subject_ids: string[];
  milestones: ReportMilestone[];
}

export interface ReportTeachCountBySubject {
  subject_id: string;
  name: string;
  count: number;
}

export interface ReportTeachCountByChild {
  child_id: string;
  first_name: string;
  total: number;
  by_subject: ReportTeachCountBySubject[];
}

export interface ProgressReport {
  generated_at: string;
  range: { from: string; to: string };
  family: ReportFamily;
  children: ReportChild[];
  curricula: ReportCurriculum[];
  projects: ReportProject[];
  teach_counts: {
    range_days: number;
    days_with_any_log: number;
    total_entries: number;
    by_child: ReportTeachCountByChild[];
    by_subject: ReportTeachCountBySubject[];
  };
}

export function useProgressReport(from: string, to: string, childId?: string | null) {
  const [data, setData] = useState<ProgressReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ from, to });
      if (childId) params.set('child_id', childId);
      try {
        const res = await fetch(`/api/v1/progress/report?${params}`, { credentials: 'include' });
        if (!cancelled) {
          if (!res.ok) {
            setError('Failed to load progress report.');
            setData(null);
          } else {
            setData(await res.json());
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load progress report.');
          setData(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [from, to, childId]);

  return { data, isLoading, error };
}
