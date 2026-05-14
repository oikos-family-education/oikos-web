import { describe, it, expect } from 'vitest';
import {
  addDays,
  buildLessonWeekDays,
  formatDuration,
  getLessonStatusColor,
  groupLessonsByDate,
  isLessonActionable,
  startOfWeekISO,
  type LessonStatus,
  type LessonSummary,
} from '../../lib/lessonUtils';

function makeLesson(overrides: Partial<LessonSummary> = {}): LessonSummary {
  return {
    id: overrides.id || `id-${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title || 'Untitled',
    status: overrides.status || 'draft',
    scheduled_for: overrides.scheduled_for || '2026-05-08',
    estimated_duration_minutes: overrides.estimated_duration_minutes ?? null,
    reference_number: overrides.reference_number ?? null,
    sequence_number: overrides.sequence_number ?? 1,
    subject: overrides.subject || {
      id: 's1', name: 'Math', color: null, icon: null,
      curriculum_ids: [], child_ids: [], project_ids: [],
    },
    tags: overrides.tags || [],
  };
}

describe('getLessonStatusColor', () => {
  it('returns a Tailwind class string for every status', () => {
    const statuses: LessonStatus[] = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];
    for (const s of statuses) {
      const cls = getLessonStatusColor(s);
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    }
  });
});

describe('isLessonActionable', () => {
  it('treats draft, scheduled, in_progress as actionable', () => {
    expect(isLessonActionable('draft')).toBe(true);
    expect(isLessonActionable('scheduled')).toBe(true);
    expect(isLessonActionable('in_progress')).toBe(true);
  });

  it('treats completed and cancelled as terminal', () => {
    expect(isLessonActionable('completed')).toBe(false);
    expect(isLessonActionable('cancelled')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('returns empty string for null and zero', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(0)).toBe('');
  });

  it('formats positive minutes', () => {
    expect(formatDuration(45)).toBe('45 min');
  });
});

describe('addDays', () => {
  it('returns the next ISO day', () => {
    expect(addDays('2026-05-08', 1)).toBe('2026-05-09');
  });

  it('handles month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('handles negative offsets', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('startOfWeekISO', () => {
  it('returns the previous Monday for a Wednesday', () => {
    // 2026-05-06 is a Wednesday
    expect(startOfWeekISO('2026-05-06')).toBe('2026-05-04');
  });

  it('returns Monday itself when given a Monday', () => {
    expect(startOfWeekISO('2026-05-04')).toBe('2026-05-04');
  });

  it('rolls Sunday back to the prior Monday', () => {
    // 2026-05-10 is a Sunday
    expect(startOfWeekISO('2026-05-10')).toBe('2026-05-04');
  });
});

describe('groupLessonsByDate', () => {
  it('groups lessons by their scheduled_for date', () => {
    const lessons = [
      makeLesson({ id: 'a', title: 'Beta',  scheduled_for: '2026-05-08' }),
      makeLesson({ id: 'b', title: 'Alpha', scheduled_for: '2026-05-08' }),
      makeLesson({ id: 'c', title: 'Gamma', scheduled_for: '2026-05-09' }),
    ];
    const out = groupLessonsByDate(lessons);
    expect(Object.keys(out).sort()).toEqual(['2026-05-08', '2026-05-09']);
    expect(out['2026-05-08'].map((l) => l.title)).toEqual(['Alpha', 'Beta']);
    expect(out['2026-05-09'].map((l) => l.title)).toEqual(['Gamma']);
  });

  it('returns an empty object for empty input', () => {
    expect(groupLessonsByDate([])).toEqual({});
  });
});

describe('buildLessonWeekDays', () => {
  it('returns 7 days starting at the provided week_start', () => {
    const days = buildLessonWeekDays('2026-05-04', {});
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-05-04');
    expect(days[6].date).toBe('2026-05-10');
  });

  it('attaches lessons for matching dates and leaves others empty', () => {
    const lessons = [
      makeLesson({ scheduled_for: '2026-05-04' }),
      makeLesson({ scheduled_for: '2026-05-06' }),
    ];
    const grouped = groupLessonsByDate(lessons);
    const days = buildLessonWeekDays('2026-05-04', grouped);
    expect(days[0].lessons).toHaveLength(1);
    expect(days[1].lessons).toEqual([]);
    expect(days[2].lessons).toHaveLength(1);
  });
});
