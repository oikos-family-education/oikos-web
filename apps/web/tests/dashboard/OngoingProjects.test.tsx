import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { OngoingProjects } from '../../components/dashboard/OngoingProjects';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const makeProject = (overrides = {}) => ({
  id: 'p1',
  family_id: 'f1',
  title: 'Science Fair',
  due_date: null,
  status: 'active',
  children: [{ project_id: 'p1', child_id: 'c1' }],
  milestone_count: 3,
  completions: [],
  ...overrides,
});

describe('OngoingProjects widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows project title after loading', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeProject()],
    } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      expect(screen.getByText('Science Fair')).toBeInTheDocument();
    });
  });

  it('shows empty state when no active projects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      expect(screen.getByText(/no active projects/i)).toBeInTheDocument();
    });
  });

  it('shows overdue label when due_date is in the past', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const isoDate = pastDate.toISOString().split('T')[0];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeProject({ due_date: isoDate })],
    } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });
  });

  it('shows due-soon label when due_date is within 7 days', async () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 3);
    const isoDate = soonDate.toISOString().split('T')[0];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeProject({ due_date: isoDate })],
    } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      // "Due in 3 days" or "Due today"
      expect(screen.getByText(/due in|due today/i)).toBeInTheDocument();
    });
  });

  it('renders a progress bar when there are milestones', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeProject({ milestone_count: 4, completions: [{ milestone_id: 'm1', child_id: 'c1' }] })],
    } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      // Progress bar: div with a width style
      const progressBars = document.querySelectorAll('[style*="width"]');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  it('shows error state and retry on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('retries fetch when Try again is clicked', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [makeProject()] } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => screen.getByRole('button', { name: /try again/i }));
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Science Fair')).toBeInTheDocument();
    });
  });

  it('shows milestone progress text', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeProject({ milestone_count: 3, completions: [] })],
    } as Response);

    renderWithProviders(<OngoingProjects />);

    await waitFor(() => {
      expect(screen.getByText(/0\/3 milestones/i)).toBeInTheDocument();
    });
  });
});
