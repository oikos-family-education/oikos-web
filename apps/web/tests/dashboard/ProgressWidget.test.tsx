import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ProgressWidget } from '../../components/dashboard/ProgressWidget';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('../../components/dashboard/QuickProgressModal', () => ({
  QuickProgressModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="progress-modal" /> : null,
}));

const mockSummary = {
  range: { from: '2024-01-01', to: '2024-01-31' },
  overall_streak: {
    current_weeks: 3,
    longest_weeks: 5,
    weekly_target: 4,
    this_week_count: 2,
    last_met_week_start: null,
  },
  per_child_streaks: [],
  per_subject_streaks: [],
  teach_counts: { total: 12, by_child: [], by_subject: [] },
  heatmap: [],
};

describe('ProgressWidget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading state initially', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProviders(<ProgressWidget />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('shows the streak banner when current_weeks > 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    renderWithProviders(<ProgressWidget />);

    await waitFor(() => {
      // 3-week streak text
      expect(screen.getByText(/3-week streak/i)).toBeInTheDocument();
    });
  });

  it('shows weekly progress text below the streak when target is set', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    renderWithProviders(<ProgressWidget />);

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 4 this week/i)).toBeInTheDocument();
    });
  });

  it('shows "start your streak" message when no streak', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockSummary,
        overall_streak: { ...mockSummary.overall_streak, current_weeks: 0 },
      }),
    } as Response);

    renderWithProviders(<ProgressWidget />);

    await waitFor(() => {
      expect(screen.getByText(/start your streak/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<ProgressWidget />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('renders 7 day cells in the mini heatmap', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { container } = renderWithProviders(<ProgressWidget />);

    await waitFor(() => {
      // Each day cell has aria-label, so count those
      const cells = container.querySelectorAll('[aria-label]');
      expect(cells.length).toBeGreaterThanOrEqual(7);
    });
  });

  it('opens the progress log modal when "Log today\'s session" is clicked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    renderWithProviders(<ProgressWidget />);

    await waitFor(() => screen.getByRole('button', { name: /log/i }));
    await userEvent.click(screen.getByRole('button', { name: /log/i }));
    expect(screen.getByTestId('progress-modal')).toBeInTheDocument();
  });
});
