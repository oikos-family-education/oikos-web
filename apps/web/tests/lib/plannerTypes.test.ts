/**
 * Tests for pure-function utilities in components/planner/types.ts
 */
import { describe, it, expect } from 'vitest';
import {
  minuteToTime,
  parseTime,
  priorityFromNumber,
  priorityColor,
  isCustomActivity,
  encodeCustomNotes,
  parseCustomNotes,
  CUSTOM_ICONS,
  CUSTOM_COLORS,
  DAY_NAMES,
  DAY_SHORTS,
  HOURS_START,
  HOURS_END,
  HOUR_COUNT,
  type RoutineEntryData,
} from '../../components/planner/types';

const baseEntry = (overrides: Partial<RoutineEntryData> = {}): RoutineEntryData => ({
  id: 'r1',
  template_id: 't1',
  subject_id: null,
  is_free_time: false,
  child_ids: [],
  day_of_week: 0,
  start_minute: 540,
  duration_minutes: 60,
  priority: 'medium',
  color: null,
  notes: null,
  ...overrides,
} as RoutineEntryData);

describe('minuteToTime', () => {
  it('formats minutes as HH:MM', () => {
    expect(minuteToTime(0)).toBe('00:00');
    expect(minuteToTime(540)).toBe('09:00');
    expect(minuteToTime(615)).toBe('10:15');
    expect(minuteToTime(1439)).toBe('23:59');
  });
});

describe('parseTime', () => {
  it('returns minutes for valid HH:MM strings', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('09:00')).toBe(540);
    expect(parseTime('23:59')).toBe(1439);
  });

  it('returns null for invalid formats', () => {
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('not-a-time')).toBeNull();
  });
});

describe('priorityFromNumber', () => {
  it('maps 1 to high', () => expect(priorityFromNumber(1)).toBe('high'));
  it('maps 3 to low', () => expect(priorityFromNumber(3)).toBe('low'));
  it('defaults all other numbers to medium', () => {
    expect(priorityFromNumber(0)).toBe('medium');
    expect(priorityFromNumber(2)).toBe('medium');
    expect(priorityFromNumber(99)).toBe('medium');
  });
});

describe('priorityColor', () => {
  it('returns red for high', () => expect(priorityColor('high')).toBe('bg-red-500'));
  it('returns green for low', () => expect(priorityColor('low')).toBe('bg-green-500'));
  it('returns amber for medium', () => expect(priorityColor('medium')).toBe('bg-amber-400'));
});

describe('isCustomActivity', () => {
  it('returns true when neither free-time nor subject linked', () => {
    expect(isCustomActivity(baseEntry({ is_free_time: false, subject_id: null }))).toBe(true);
  });

  it('returns false for free-time entries', () => {
    expect(isCustomActivity(baseEntry({ is_free_time: true, subject_id: null }))).toBe(false);
  });

  it('returns false for subject entries', () => {
    expect(isCustomActivity(baseEntry({ is_free_time: false, subject_id: 's1' }))).toBe(false);
  });
});

describe('encodeCustomNotes / parseCustomNotes', () => {
  it('encodes icon, name, and userNotes into newline-separated string', () => {
    expect(encodeCustomNotes('🎨', 'Drawing', 'Daily art time')).toBe('🎨\nDrawing\nDaily art time');
  });

  it('encodes without userNotes when omitted', () => {
    expect(encodeCustomNotes('🎵', 'Music')).toBe('🎵\nMusic');
  });

  it('parses a 3-part encoded string', () => {
    const parsed = parseCustomNotes('🎨\nDrawing\nDaily art time');
    expect(parsed).toEqual({ icon: '🎨', name: 'Drawing', userNotes: 'Daily art time' });
  });

  it('handles 2-part encoded string (no userNotes)', () => {
    expect(parseCustomNotes('🎵\nMusic')).toEqual({ icon: '🎵', name: 'Music', userNotes: '' });
  });

  it('handles userNotes containing newlines', () => {
    const encoded = encodeCustomNotes('🎯', 'Goals', 'Line 1\nLine 2');
    expect(parseCustomNotes(encoded)).toEqual({
      icon: '🎯',
      name: 'Goals',
      userNotes: 'Line 1\nLine 2',
    });
  });

  it('returns default values for null input', () => {
    expect(parseCustomNotes(null)).toEqual({
      icon: '✏️',
      name: 'Custom Activity',
      userNotes: '',
    });
  });

  it('returns sensible default for single-line input', () => {
    expect(parseCustomNotes('Just a name')).toEqual({
      icon: '✏️',
      name: 'Just a name',
      userNotes: '',
    });
  });
});

describe('constants', () => {
  it('has 7 day names matching the week', () => {
    expect(DAY_NAMES.length).toBe(7);
    expect(DAY_NAMES[0]).toBe('monday');
    expect(DAY_NAMES[6]).toBe('sunday');
  });

  it('DAY_SHORTS aligns with DAY_NAMES length', () => {
    expect(DAY_SHORTS.length).toBe(7);
  });

  it('HOUR_COUNT is HOURS_END - HOURS_START + 1', () => {
    expect(HOUR_COUNT).toBe(HOURS_END - HOURS_START + 1);
  });

  it('CUSTOM_ICONS is non-empty', () => {
    expect(CUSTOM_ICONS.length).toBeGreaterThan(0);
  });

  it('CUSTOM_COLORS are valid hex codes', () => {
    for (const c of CUSTOM_COLORS) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
