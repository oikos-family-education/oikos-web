import { describe, it, expect } from 'vitest';
import { buildDaySchedule, defaultDayIndex, stepDayIndex, FAMILY_COLUMN_ID } from '../../components/planner/dayView';
import type { ChildData, GridConfig, RoutineEntryData } from '../../components/planner/types';

const weekdaysOnly: GridConfig = { start_hour: 8, end_hour: 16, include_saturday: false, include_sunday: false };
const fullWeek: GridConfig = { ...weekdaysOnly, include_saturday: true, include_sunday: true };

function child(id: string, is_active = true): ChildData {
  return {
    id, name: id, first_name: id, nickname: null, birthdate: null, birth_year: null,
    birth_month: null, grade_level: null, is_active,
  };
}

function entry(id: string, overrides: Partial<RoutineEntryData> = {}): RoutineEntryData {
  return {
    id, template_id: 't', family_id: 'f', subject_id: 's1', is_free_time: false, child_ids: [],
    day_of_week: 0, start_minute: 540, duration_minutes: 45, priority: 'medium', color: null,
    notes: null, created_at: '', updated_at: '', ...overrides,
  };
}

describe('defaultDayIndex', () => {
  it('opens on today when today is a visible day', () => {
    // 2026-10-21 is a Wednesday
    expect(defaultDayIndex(weekdaysOnly, new Date(2026, 9, 21))).toBe(2);
  });

  it('falls back to Monday when today is a hidden weekend day', () => {
    // 2026-10-24 is a Saturday
    expect(defaultDayIndex(weekdaysOnly, new Date(2026, 9, 24))).toBe(0);
    expect(defaultDayIndex(fullWeek, new Date(2026, 9, 24))).toBe(5);
  });
});

describe('stepDayIndex', () => {
  it('wraps around the visible days', () => {
    expect(stepDayIndex(weekdaysOnly, 4, 1)).toBe(0);
    expect(stepDayIndex(weekdaysOnly, 0, -1)).toBe(4);
    expect(stepDayIndex(fullWeek, 4, 1)).toBe(5);
    expect(stepDayIndex(fullWeek, 6, 1)).toBe(0);
  });
});

describe('buildDaySchedule', () => {
  const kids = [child('ana'), child('ben'), child('old', false)];

  it('creates one column per active child and one row per start time', () => {
    const schedule = buildDaySchedule(
      [
        entry('math', { child_ids: ['ana'], start_minute: 540 }),
        entry('read', { child_ids: ['ben'], start_minute: 540 }),
        entry('art', { child_ids: ['ana', 'ben'], start_minute: 600 }),
        entry('tuesday', { child_ids: ['ana'], day_of_week: 1 }),
      ],
      kids,
      0,
    );

    expect(schedule.columns.map((c) => c.id)).toEqual(['ana', 'ben']);
    expect(schedule.rows.map((r) => r.startMinute)).toEqual([540, 600]);
    expect(schedule.rows[0].cells.ana.map((e) => e.id)).toEqual(['math']);
    expect(schedule.rows[0].cells.ben.map((e) => e.id)).toEqual(['read']);
    // Shared entries appear in every child's column
    expect(schedule.rows[1].cells.ana.map((e) => e.id)).toEqual(['art']);
    expect(schedule.rows[1].cells.ben.map((e) => e.id)).toEqual(['art']);
  });

  it('adds a family column for entries assigned to nobody', () => {
    const schedule = buildDaySchedule(
      [entry('lunch', { is_free_time: true, subject_id: null, child_ids: [], start_minute: 720 })],
      kids,
      0,
    );
    expect(schedule.columns.map((c) => c.id)).toEqual(['ana', 'ben', FAMILY_COLUMN_ID]);
    expect(schedule.rows[0].cells[FAMILY_COLUMN_ID].map((e) => e.id)).toEqual(['lunch']);
  });

  it('skips entries that only belong to archived children', () => {
    const schedule = buildDaySchedule([entry('x', { child_ids: ['old'] })], kids, 0);
    expect(schedule.rows).toEqual([]);
    expect(schedule.columns.map((c) => c.id)).toEqual(['ana', 'ben']);
  });
});
