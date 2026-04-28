import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

describe('TodaySchedule widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows routine entry subject name after loading', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRoutineEntry()] } as Response) // week-planner/today
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) } as Response); // calendar/events

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText('Physics')).toBeInTheDocument();
    });
  });

  it('shows calendar event title after loading', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) // no routine
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [makeCalendarEvent()] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText('Science Trip')).toBeInTheDocument();
    });
  });

  it('renders both routine entries and calendar events', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRoutineEntry()] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [makeCalendarEvent()] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Science Trip')).toBeInTheDocument();
    });
  });

  it('shows "Free time" label for free-time routine entries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeRoutineEntry({ is_free_time: true, subject_name: null })],
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText('Free time')).toBeInTheDocument();
    });
  });

  it('shows empty state when both lists are empty', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText(/nothing scheduled for today/i)).toBeInTheDocument();
    });
  });

  it('shows error state when either fetch fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('shows "All day" label for all-day events', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [makeCalendarEvent({ all_day: true })] }),
      } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText('All day')).toBeInTheDocument();
    });
  });

  it('shows duration and source for routine entries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRoutineEntry()] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) } as Response);

    renderWithProviders(<TodaySchedule />);

    await waitFor(() => {
      expect(screen.getByText(/45 min/i)).toBeInTheDocument();
      expect(screen.getByText(/week planner/i)).toBeInTheDocument();
    });
  });
});
