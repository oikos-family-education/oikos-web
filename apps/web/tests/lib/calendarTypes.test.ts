/**
 * Tests for calendar pure-function utilities in components/calendar/types.ts
 */
import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPE_COLORS,
  getEventColor,
  minuteToTime,
  parseTime,
  toISODate,
  fromISODate,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  buildMonthGrid,
  buildWeekDays,
  parseServerDate,
  dayInEventRange,
  type CalendarEvent,
} from '../../components/calendar/types';

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  family_id: 'f1',
  title: 'Sample',
  description: null,
  event_type: 'family',
  all_day: false,
  start_at: '2024-06-15T10:00:00Z',
  end_at: '2024-06-15T11:00:00Z',
  child_ids: [],
  subject_id: null,
  project_id: null,
  milestone_id: null,
  color: null,
  location: null,
  recurrence: 'none',
  is_system: false,
  source_url: null,
  ...overrides,
});

describe('getEventColor', () => {
  it('returns the system color for system events', () => {
    expect(getEventColor(baseEvent({ is_system: true, color: '#aabbcc' }))).toBe(
      EVENT_TYPE_COLORS.system,
    );
  });

  it('returns the custom color when set on a non-system event', () => {
    expect(getEventColor(baseEvent({ color: '#123456' }))).toBe('#123456');
  });

  it('falls back to event_type color when no custom color is set', () => {
    expect(getEventColor(baseEvent({ event_type: 'subject' }))).toBe(EVENT_TYPE_COLORS.subject);
    expect(getEventColor(baseEvent({ event_type: 'project' }))).toBe(EVENT_TYPE_COLORS.project);
    expect(getEventColor(baseEvent({ event_type: 'curriculum' }))).toBe(EVENT_TYPE_COLORS.curriculum);
    expect(getEventColor(baseEvent({ event_type: 'family' }))).toBe(EVENT_TYPE_COLORS.family);
  });
});

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
    expect(parseTime('not a time')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
});

describe('toISODate / fromISODate', () => {
  it('toISODate formats a Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2024, 5, 15); // local June 15
    expect(toISODate(d)).toBe('2024-06-15');
  });

  it('toISODate pads single-digit month and day', () => {
    expect(toISODate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('fromISODate parses a YYYY-MM-DD string in local time', () => {
    const d = fromISODate('2024-06-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });

  it('round-trips toISODate ↔ fromISODate', () => {
    const original = new Date(2024, 11, 31);
    expect(toISODate(fromISODate(toISODate(original)))).toBe('2024-12-31');
  });
});

describe('startOfWeek / endOfWeek (Monday-based)', () => {
  it('returns Monday for a Wednesday', () => {
    const wed = new Date(2024, 5, 12); // Wed Jun 12, 2024
    const mon = startOfWeek(wed);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(10);
  });

  it('returns Monday when input is already Monday', () => {
    const mon = new Date(2024, 5, 10);
    expect(startOfWeek(mon).getDate()).toBe(10);
  });

  it('returns previous Monday for a Sunday', () => {
    const sun = new Date(2024, 5, 16);
    expect(startOfWeek(sun).getDate()).toBe(10);
  });

  it('endOfWeek returns Sunday at end-of-day', () => {
    const wed = new Date(2024, 5, 12);
    const end = endOfWeek(wed);
    expect(end.getDay()).toBe(0); // Sunday
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('startOfMonth is day 1 at midnight', () => {
    const d = startOfMonth(new Date(2024, 5, 15));
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5);
    expect(d.getHours()).toBe(0);
  });

  it('endOfMonth is the last day at end-of-day', () => {
    const d = endOfMonth(new Date(2024, 1, 15)); // Feb (leap year)
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(23);
  });

  it('handles 30-day months', () => {
    expect(endOfMonth(new Date(2024, 3, 1)).getDate()).toBe(30); // April
  });
});

describe('addDays / addMonths', () => {
  it('addDays moves forward and backward', () => {
    const base = new Date(2024, 5, 15);
    expect(addDays(base, 5).getDate()).toBe(20);
    expect(addDays(base, -5).getDate()).toBe(10);
  });

  it('addDays handles month rollover', () => {
    const base = new Date(2024, 5, 28);
    const result = addDays(base, 5);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(3);
  });

  it('addMonths moves forward and backward', () => {
    const base = new Date(2024, 5, 15);
    expect(addMonths(base, 2).getMonth()).toBe(7);
    expect(addMonths(base, -2).getMonth()).toBe(3);
  });

  it('does not mutate the input date', () => {
    const base = new Date(2024, 5, 15);
    addDays(base, 5);
    expect(base.getDate()).toBe(15);
  });
});

describe('isSameDay / isSameMonth', () => {
  it('isSameDay matches identical Y/M/D', () => {
    expect(isSameDay(new Date(2024, 5, 15, 9), new Date(2024, 5, 15, 18))).toBe(true);
    expect(isSameDay(new Date(2024, 5, 15), new Date(2024, 5, 16))).toBe(false);
    expect(isSameDay(new Date(2024, 5, 15), new Date(2024, 6, 15))).toBe(false);
  });

  it('isSameMonth matches identical Y/M', () => {
    expect(isSameMonth(new Date(2024, 5, 1), new Date(2024, 5, 30))).toBe(true);
    expect(isSameMonth(new Date(2024, 5, 1), new Date(2024, 6, 1))).toBe(false);
    expect(isSameMonth(new Date(2024, 5, 1), new Date(2025, 5, 1))).toBe(false);
  });
});

describe('buildMonthGrid', () => {
  it('returns exactly 42 days', () => {
    expect(buildMonthGrid(new Date(2024, 5, 15)).length).toBe(42);
  });

  it('starts on a Monday', () => {
    const grid = buildMonthGrid(new Date(2024, 5, 15));
    expect(grid[0].getDay()).toBe(1);
  });

  it('contains all days of the target month', () => {
    const grid = buildMonthGrid(new Date(2024, 5, 15));
    const monthDays = grid.filter((d) => d.getMonth() === 5);
    expect(monthDays.length).toBe(30); // June has 30 days
  });
});

describe('buildWeekDays', () => {
  it('returns 7 consecutive days starting Monday', () => {
    const days = buildWeekDays(new Date(2024, 5, 15)); // Sat
    expect(days.length).toBe(7);
    expect(days[0].getDay()).toBe(1); // Mon
    expect(days[6].getDay()).toBe(0); // Sun
    expect(days[6].getDate() - days[0].getDate()).toBe(6);
  });
});

describe('parseServerDate', () => {
  it('parses an ISO string into a Date', () => {
    const d = parseServerDate('2024-06-15T10:00:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
  });
});

describe('dayInEventRange', () => {
  it('returns true for the event start day', () => {
    const event = baseEvent({
      start_at: new Date(2024, 5, 15, 10).toISOString(),
      end_at: new Date(2024, 5, 15, 11).toISOString(),
    });
    expect(dayInEventRange(new Date(2024, 5, 15), event)).toBe(true);
  });

  it('returns true for a day inside a multi-day event range', () => {
    const event = baseEvent({
      start_at: new Date(2024, 5, 15).toISOString(),
      end_at: new Date(2024, 5, 17, 23).toISOString(),
    });
    expect(dayInEventRange(new Date(2024, 5, 16), event)).toBe(true);
  });

  it('returns false for a day before the event', () => {
    const event = baseEvent({
      start_at: new Date(2024, 5, 15).toISOString(),
      end_at: new Date(2024, 5, 15, 23).toISOString(),
    });
    expect(dayInEventRange(new Date(2024, 5, 14), event)).toBe(false);
  });

  it('returns false for a day after the event', () => {
    const event = baseEvent({
      start_at: new Date(2024, 5, 15).toISOString(),
      end_at: new Date(2024, 5, 15, 23).toISOString(),
    });
    expect(dayInEventRange(new Date(2024, 5, 16), event)).toBe(false);
  });
});
