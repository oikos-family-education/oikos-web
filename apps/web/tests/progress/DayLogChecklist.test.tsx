import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { DayLogChecklist } from '../../components/progress/DayLogChecklist';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CHILDREN = [
  { id: 'c-lia', first_name: 'Lia', nickname: null },
  { id: 'c-theo', first_name: 'Theo', nickname: null },
];

const SUBJECTS = [
  { id: 's-math', name: 'Math', color: '#111111' },
  { id: 's-music', name: 'Music', color: '#222222' },
];

const PLANNER_MATH = {
  id: 'r-math',
  subject_id: 's-math',
  subject_name: 'Math',
  is_free_time: false,
  child_ids: ['c-lia', 'c-theo'],
  child_names: ['Lia', 'Theo'],
  day_of_week: 1,
  start_minute: 8 * 60 + 30,
  duration_minutes: 45,
  priority: 'normal',
  color: '#111111',
  notes: null,
};

const CURRICULUM_MATH = {
  subject_id: 's-math',
  subject_name: 'Math',
  color: '#111111',
  duration_minutes: 45,
  child_ids: ['c-lia', 'c-theo'],
  child_names: ['Lia', 'Theo'],
};

interface FetchCall {
  url: string;
  init?: RequestInit;
}

interface Responses {
  plannerToday?: unknown;
  enrollments?: unknown;
  logs?: unknown[];
}

function setupFetch(responses: Responses = {}) {
  const { plannerToday = [], enrollments = [], logs = [] } = responses;
  const calls: FetchCall[] = [];
  let logsList = Array.isArray(logs) ? [...(logs as unknown[])] : [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });

      if (url.includes('/week-planner/today')) {
        return { ok: true, status: 200, json: async () => plannerToday } as Response;
      }
      if (url.includes('/curriculums/enrollments')) {
        return { ok: true, status: 200, json: async () => enrollments } as Response;
      }
      if (url.endsWith('/api/v1/progress/logs') && init?.method === 'POST') {
        const body = JSON.parse((init.body as string) || '{}');
        const created = {
          id: `log-${Math.random().toString(36).slice(2)}`,
          taught_on: body.taught_on,
          child_id: body.child_id,
          subject_id: body.subject_id,
          minutes: body.minutes ?? null,
          notes: body.notes ?? null,
        };
        logsList.push(created);
        return { ok: true, status: 201, json: async () => created } as Response;
      }
      if (url.includes('/api/v1/progress/logs/') && init?.method === 'DELETE') {
        const id = url.split('/').pop()?.split('?')[0];
        logsList = logsList.filter((l: any) => l.id !== id);
        return { ok: true, status: 204, json: async () => ({}) } as Response;
      }
      if (url.includes('/progress/logs')) {
        return { ok: true, status: 200, json: async () => logsList } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }),
  );

  return calls;
}

describe('DayLogChecklist', () => {
  beforeEach(() => {
    // no-op — setupFetch handles per-test
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes to /week-planner/today when date is today and renders rows', async () => {
    const calls = setupFetch({ plannerToday: [PLANNER_MATH] });

    renderWithProviders(
      <DayLogChecklist date={todayIso()} childrenList={CHILDREN} subjects={SUBJECTS} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Math')).toBeInTheDocument();
    });
    // Tick badges exist for both children
    expect(
      screen.getByRole('button', { name: /Mark Math as taught for Lia/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mark Math as taught for Theo/i }),
    ).toBeInTheDocument();
    // Used the planner endpoint, NOT the curriculum endpoint
    expect(calls.some((c) => c.url.includes('/week-planner/today'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/curriculums/enrollments'))).toBe(false);
  });

  it('routes to /curriculums/enrollments when date is in the past', async () => {
    const calls = setupFetch({ enrollments: [CURRICULUM_MATH] });

    renderWithProviders(
      <DayLogChecklist
        date="2025-01-15"
        childrenList={CHILDREN}
        subjects={SUBJECTS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Math')).toBeInTheDocument();
    });
    expect(calls.some((c) => c.url.includes('/week-planner/today'))).toBe(false);
    expect(
      calls.some((c) => c.url.includes('/curriculums/enrollments?date=2025-01-15')),
    ).toBe(true);
  });

  it('shows an ad-hoc row for logs whose subject is not in the day rows', async () => {
    // No planner entries for today, but Music was logged for Lia anyway.
    setupFetch({
      plannerToday: [PLANNER_MATH],
      logs: [
        {
          id: 'log-1',
          taught_on: todayIso(),
          child_id: 'c-lia',
          subject_id: 's-music',
          minutes: 30,
          notes: null,
        },
      ],
    });

    renderWithProviders(
      <DayLogChecklist date={todayIso()} childrenList={CHILDREN} subjects={SUBJECTS} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Music')).toBeInTheDocument();
    });
    // The ad-hoc tag should be visible somewhere near Music.
    expect(screen.getAllByText(/ad-hoc/i).length).toBeGreaterThan(0);
    // And the Lia badge should be in the logged (Unmark) state.
    expect(
      screen.getByRole('button', { name: /Unmark Music for Lia/i }),
    ).toBeInTheDocument();
  });

  it('does NOT show an ad-hoc row when the log matches a planned (child, subject) pair', async () => {
    // Math is planned for Lia+Theo. A Lia/Math log should pre-tick the planned
    // row, not create an ad-hoc duplicate.
    setupFetch({
      plannerToday: [PLANNER_MATH],
      logs: [
        {
          id: 'log-1',
          taught_on: todayIso(),
          child_id: 'c-lia',
          subject_id: 's-math',
          minutes: 45,
          notes: null,
        },
      ],
    });

    renderWithProviders(
      <DayLogChecklist date={todayIso()} childrenList={CHILDREN} subjects={SUBJECTS} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Unmark Math for Lia/i }),
      ).toBeInTheDocument();
    });
    // Only one Math row should exist — no ad-hoc duplicate.
    expect(screen.getAllByText('Math').length).toBe(1);
    expect(screen.queryByText(/ad-hoc/i)).not.toBeInTheDocument();
  });

  it('POSTs a log with the correct date when a tick is clicked on a past date', async () => {
    const calls = setupFetch({ enrollments: [CURRICULUM_MATH] });

    renderWithProviders(
      <DayLogChecklist
        date="2025-01-15"
        childrenList={CHILDREN}
        subjects={SUBJECTS}
      />,
    );

    await waitFor(() => screen.getByRole('button', { name: /Mark Math as taught for Lia/i }));
    await userEvent.click(screen.getByRole('button', { name: /Mark Math as taught for Lia/i }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.url.endsWith('/api/v1/progress/logs') && c.init?.method === 'POST',
      );
      expect(post).toBeDefined();
      const body = JSON.parse(post!.init!.body as string);
      expect(body.taught_on).toBe('2025-01-15');
      expect(body.child_id).toBe('c-lia');
      expect(body.subject_id).toBe('s-math');
      expect(body.minutes).toBe(45);
    });
  });

  it('shows the empty-past message when no curricula were active', async () => {
    setupFetch({ enrollments: [] });

    renderWithProviders(
      <DayLogChecklist
        date="2020-01-15"
        childrenList={CHILDREN}
        subjects={SUBJECTS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/no curricula were active/i)).toBeInTheDocument();
    });
  });

  it('shows the past-date hint text on past dates (not the today hint)', async () => {
    setupFetch({ enrollments: [CURRICULUM_MATH] });

    renderWithProviders(
      <DayLogChecklist
        date="2025-01-15"
        childrenList={CHILDREN}
        subjects={SUBJECTS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/curricula active on this date/i)).toBeInTheDocument();
    });
  });
});
