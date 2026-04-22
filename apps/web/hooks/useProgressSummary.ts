'use client';

import { useCallback, useEffect, useState } from 'react';

export interface OverallStreak {
  current_weeks: number | null;
  longest_weeks: number | null;
  weekly_target: number | null;
  this_week_count: number;
  last_met_week_start: string | null;
}

export interface PerChildStreak {
  child_id: string;
  first_name: string;
  current_weeks: number | null;
  longest_weeks: number | null;
  weekly_target: number | null;
  this_week_count: number;
}

export interface PerSubjectStreak {
  subject_id: string;
  name: string;
  color: string;
  current_weeks: number | null;
  longest_weeks: number | null;
  weekly_target: number | null;
  this_week_count: number;
}

export interface TeachCountByChild {
  child_id: string;
  first_name: string;
  count: number;
}

export interface TeachCountBySubject {
  subject_id: string;
  name: string;
  color: string;
  count: number;
}

export interface ProgressSummary {
  range: { from: string; to: string };
  overall_streak: OverallStreak;
  per_child_streaks: PerChildStreak[];
  per_subject_streaks: PerSubjectStreak[];
  teach_counts: {
    total: number;
    by_child: TeachCountByChild[];
    by_subject: TeachCountBySubject[];
  };
  heatmap: { date: string; count: number }[];
}

export function useProgressSummary(from: string, to: string, childId?: string | null) {
  const [data, setData] = useState<ProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to });
    if (childId) params.set('child_id', childId);
    try {
      const res = await fetch(`/api/v1/progress/summary?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setError('Failed to load progress summary.');
        setData(null);
      } else {
        setData(await res.json());
      }
    } catch {
      setError('Failed to load progress summary.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [from, to, childId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, isLoading, error, refetch: fetchSummary };
}
