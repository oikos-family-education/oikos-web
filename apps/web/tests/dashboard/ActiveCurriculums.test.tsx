import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ActiveCurriculums } from '../../components/dashboard/ActiveCurriculums';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const mockActive = {
  id: 'c1',
  name: 'Year 1 Plan',
  description: null,
  period_type: 'annual',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  status: 'active',
  child_curriculums: [{ child_id: 'ch1', curriculum_id: 'c1' }],
};

const mockDetail = {
  ...mockActive,
  curriculum_subjects: [
    { subject_id: 's1', is_active: true },
    { subject_id: 's2', is_active: true },
    { subject_id: 's3', is_active: false },
  ],
};

describe('ActiveCurriculums widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows curriculum name after loading', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockActive] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockDetail } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      expect(screen.getByText('Year 1 Plan')).toBeInTheDocument();
    });
  });

  it('shows the correct active subject count', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockActive] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockDetail } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      // 2 active subjects, 1 child
      expect(screen.getByText(/2 subjects/i)).toBeInTheDocument();
      expect(screen.getByText(/1 child/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no active curricula exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      expect(screen.getByText(/no active curricula/i)).toBeInTheDocument();
    });
  });

  it('filters out non-active curricula', async () => {
    const draftCurriculum = { ...mockActive, id: 'c2', name: 'Draft Plan', status: 'draft' };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockActive, draftCurriculum],
    } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockDetail } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      expect(screen.getByText('Year 1 Plan')).toBeInTheDocument();
      expect(screen.queryByText('Draft Plan')).not.toBeInTheDocument();
    });
  });

  it('shows error state and retry button on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('retries when Try again is clicked', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    renderWithProviders(<ActiveCurriculums />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText(/no active curricula/i)).toBeInTheDocument();
    });
  });
});
