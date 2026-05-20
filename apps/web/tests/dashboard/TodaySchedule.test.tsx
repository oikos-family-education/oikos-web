import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { TodaySchedule } from '../../components/dashboard/TodaySchedule';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const makeRoutineEntry = (overrides = {}) => ({
  id: 'r1',
  subject_id: 's1',
  subject_name: 'Physics',
  is_free_time: false,
  child_ids: ['c1'],
  child_names: ['Alice'],
  day_of_week: 1,
  start_minute: 540,
  duration_minutes: 45,
  priority: 'high',
  color: '#4f46e5',
  notes: null,
  ...overrides,
});

const makeCalendarEvent = (overrides = {}) => ({
  id: 'ev1',
  family_id: 'f1',
  title: 'Science Trip',
  description: null,
  event_type: 'trip',
  all_day: false,
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 3600000).toISOString(),
  child_ids: ['c1'],
  color: '#22c55e',
  location: null,
  ...overrides,
});

const EMPTY_SUMMARY = {
  range: { from: '2024-01-01', to: '2024-01-31' },
  overall_streak: {
    current_weeks: 0,
    longest_weeks: 0,
    weekly_target: null,
    this_week_count: 0,
    last_met_week_start: null,
  },
  per_child_streaks: [],
  per_subject_streaks: [],
  teach_counts: { total: 0, by_child: [], by_subject: [] },
  heatmap: [],
};

interface MockResponses {
  routines?: unknown;
  events?: { events: unknown[] };
  lessons?: unknown;
  logs?: unknown[];
  summary?: unknown;
  routinesStatus?: number;
  eventsStatus?: number;
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function setupFetch(responses: MockResponses) {
  const {
    routines = [],
    events = { events: [] },
    lessons = [],
    logs = [],
    summary = EMPTY_SUMMARY,
    routinesStatus = 200,
    eventsStatus = 200,
  } = responses;
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      const ok = (s: number) => s >= 200 && s < 300;
      if (url.includes('/week-planner/today')) {
        return { ok: ok(routinesStatus), status: routinesStatus, json: async () => routines } as Response;
      }
      if (url.includes('/calendar/events')) {
        return { ok: ok(eventsStatus), status: eventsStatus, json: async () => events } as Response;
      }
      if (url.includes('/lessons/today')) {
        return { ok: true, status: 200, json: async () => lessons } as Response;
      }
      if (url.endsWith('/api/v1/progress/logs') && init?.method === 'POST') {
        const body = JSON.parse((init.body as string) || '{}');
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: `new-${Math.random()}`,
            taught_on: body.taught_on,
            child_id: body.child_id,
            subject_id: body.subject_id,
            minutes: body.minutes,
            notes: null,
          }),
        } as Response;
      }
      if (url.includes('/progress/logs')) {
        return { ok: true, status: 200, json: async () => logs } as Response;
      }
      if (url.includes('/progress/summary')) {
        return { ok: true, status: 200, json: async () => summary } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }),
  );
  return calls;
}

describe('TodaySchedule widget', () => {
  beforeEach(() => {
    // empty — setupFetch handles stubbing per-test
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows routine entry subject name after loading', async () => {
    setupFetch({ routines: [makeRoutineEntry()] });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Physics')).toBeInTheDocument();
    });
  });

  it('shows calendar event title after loading', async () => {
    setupFetch({ events: { events: [makeCalendarEvent()] } });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Science Trip')).toBeInTheDocument();
    });
  });

  it('renders both routine entries and calendar events', async () => {
    setupFetch({
      routines: [makeRoutineEntry()],
      events: { events: [makeCalendarEvent()] },
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Science Trip')).toBeInTheDocument();
    });
  });

  it('shows "Free time" label for free-time routine entries', async () => {
    setupFetch({
      routines: [makeRoutineEntry({ is_free_time: true, subject_name: null, subject_id: null })],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Free time')).toBeInTheDocument();
    });
  });

  it('shows empty state when both lists are empty', async () => {
    setupFetch({});
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/nothing scheduled for today/i)).toBeInTheDocument();
    });
  });

  it('shows error state when routine fetch fails', async () => {
    setupFetch({ routinesStatus: 500 });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('shows "All day" label for all-day events', async () => {
    setupFetch({ events: { events: [makeCalendarEvent({ all_day: true })] } });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('All day')).toBeInTheDocument();
    });
  });

  it('shows duration and source for routine entries', async () => {
    setupFetch({ routines: [makeRoutineEntry()] });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/45 min/i)).toBeInTheDocument();
      expect(screen.getByText(/week planner/i)).toBeInTheDocument();
    });
  });

  // ─── tick column / mark everything ───

  it('renders a tick button per scheduled child for tickable routines', async () => {
    setupFetch({
      routines: [
        makeRoutineEntry({
          child_ids: ['c1', 'c2'],
          child_names: ['Alice', 'Bob'],
        }),
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mark Physics as taught for Alice/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Physics as taught for Bob/i })).toBeInTheDocument();
    });
  });

  it('does not render tick buttons for free-time routines', async () => {
    setupFetch({
      routines: [
        makeRoutineEntry({
          is_free_time: true,
          subject_name: null,
          subject_id: null,
        }),
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Free time')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Mark .* as taught for/i }),
    ).not.toBeInTheDocument();
  });

  it('pre-ticks cells that already have a log for today', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setupFetch({
      routines: [makeRoutineEntry()],
      logs: [
        {
          id: 'log-1',
          taught_on: todayStr,
          child_id: 'c1',
          subject_id: 's1',
          minutes: 45,
          notes: null,
        },
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Unmark Physics for Alice/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows "Mark everything as taught" when there is an unticked routine', async () => {
    setupFetch({ routines: [makeRoutineEntry()] });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /mark all as taught/i }),
      ).toBeInTheDocument();
    });
  });

  it('hides "Mark everything" and shows "Everything logged" when fully ticked', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setupFetch({
      routines: [makeRoutineEntry()],
      logs: [
        {
          id: 'log-1',
          taught_on: todayStr,
          child_id: 'c1',
          subject_id: 's1',
          minutes: 45,
          notes: null,
        },
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/all marked as taught/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /mark all as taught/i }),
    ).not.toBeInTheDocument();
  });

  it('fans out one POST per (child × subject) for "Mark everything as taught"', async () => {
    const calls = setupFetch({
      routines: [
        makeRoutineEntry({
          child_ids: ['c1', 'c2'],
          child_names: ['Alice', 'Bob'],
        }),
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /mark all as taught/i }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: /mark all as taught/i }),
    );
    await waitFor(() => {
      const posts = calls.filter(
        (c) => c.url.endsWith('/api/v1/progress/logs') && c.init?.method === 'POST',
      );
      expect(posts.length).toBe(2);
    });
    const posts = calls.filter(
      (c) => c.url.endsWith('/api/v1/progress/logs') && c.init?.method === 'POST',
    );
    for (const c of posts) {
      const body = JSON.parse(c.init!.body as string);
      expect(body.child_id).toBeTruthy();
      expect(body.subject_id).toBe('s1');
      expect(body.minutes).toBe(45);
    }
  });

  it('shows the streak chip with the current week count', async () => {
    setupFetch({
      summary: {
        ...EMPTY_SUMMARY,
        overall_streak: {
          ...EMPTY_SUMMARY.overall_streak,
          current_weeks: 4,
          weekly_target: 5,
          this_week_count: 3,
        },
      },
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/4-week streak/i)).toBeInTheDocument();
    });
  });

  it('shows the badge-hint banner when at least one tickable routine is scheduled', async () => {
    setupFetch({ routines: [makeRoutineEntry()] });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(
        screen.getByText(/mark it as taught today/i),
      ).toBeInTheDocument();
    });
  });

  it('hides the badge-hint banner when only free-time routines are scheduled', async () => {
    setupFetch({
      routines: [
        makeRoutineEntry({
          is_free_time: true,
          subject_name: null,
          subject_id: null,
        }),
      ],
    });
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText('Free time')).toBeInTheDocument();
    });
    expect(screen.queryByText(/mark it as taught today/i)).not.toBeInTheDocument();
  });

  it('shows the streak banner empty state when there is no streak', async () => {
    setupFetch({});
    renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/start your streak/i)).toBeInTheDocument();
    });
  });

  it('renders 7 week-bar cells in the streak banner', async () => {
    setupFetch({
      summary: {
        ...EMPTY_SUMMARY,
        overall_streak: { ...EMPTY_SUMMARY.overall_streak, current_weeks: 1 },
      },
    });
    const { container } = renderWithProviders(<TodaySchedule />);
    await waitFor(() => {
      expect(screen.getByText(/1-week streak/i)).toBeInTheDocument();
    });
    // 7 mini bars, each carrying an aria-label like "M: not logged" etc.
    const bars = container.querySelectorAll(
      'span[aria-label*="logged"], span[aria-label*="today"], span[aria-label*="upcoming"]',
    );
    expect(bars.length).toBe(7);
  });
});
