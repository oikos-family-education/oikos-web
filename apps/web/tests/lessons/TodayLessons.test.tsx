import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { TodayLessons } from '../../components/dashboard/TodayLessons';
import type { LessonSummary } from '../../lib/lessonUtils';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

function makeLesson(overrides: Partial<LessonSummary> = {}): LessonSummary {
  return {
    id: overrides.id || 'l1',
    title: overrides.title || 'Multiplication',
    status: overrides.status || 'scheduled',
    scheduled_for: overrides.scheduled_for || '2026-05-08',
    estimated_duration_minutes: overrides.estimated_duration_minutes ?? 30,
    subject: overrides.subject || {
      id: 's1', name: 'Math', color: '#6366F1', icon: null,
      curriculum_ids: [], child_ids: [], project_ids: [],
    },
    tags: overrides.tags || [],
  };
}

describe('TodayLessons widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a card per lesson returned by the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeLesson({ title: 'Multiplication tables' })],
    } as Response);

    renderWithProviders(<TodayLessons />);

    await waitFor(() => {
      expect(screen.getByText('Multiplication tables')).toBeInTheDocument();
    });
  });

  it('shows the empty state when the list is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderWithProviders(<TodayLessons />);

    await waitFor(() => {
      expect(screen.getByText(/No lessons planned today/i)).toBeInTheDocument();
    });
  });

  it('shows the error retry button when the fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({}),
    } as Response);

    renderWithProviders(<TodayLessons />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('does not render the mark-complete button on completed lessons', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeLesson({ status: 'completed' })],
    } as Response);

    renderWithProviders(<TodayLessons />);

    await waitFor(() => {
      expect(screen.getByText('Multiplication')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /mark complete/i })).toBeNull();
  });

  it('calls PATCH /lessons/:id/status when mark-complete is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce({                                  // initial GET
        ok: true,
        json: async () => [makeLesson({ id: 'lx', status: 'scheduled' })],
      } as Response)
      .mockResolvedValueOnce({                                  // PATCH
        ok: true, json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({                                  // re-fetch
        ok: true, json: async () => [],
      } as Response);

    renderWithProviders(<TodayLessons />);

    const btn = await screen.findByRole('button', { name: /mark complete/i });
    await user.click(btn);

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls;
      const patchCall = calls.find(([url, init]) =>
        String(url).includes('/api/v1/lessons/lx/status')
        && (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
    });
  });
});
