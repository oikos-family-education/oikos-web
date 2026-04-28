import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { NeglectedSubjects } from '../../components/dashboard/NeglectedSubjects';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const makeSubject = (overrides = {}) => ({
  subject_id: 's1',
  subject_name: 'Mathematics',
  color: '#4f46e5',
  days_since_last_log: 18,
  last_taught_on: '2024-01-01',
  assigned_child_names: ['Alice'],
  ...overrides,
});

describe('NeglectedSubjects widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows subject name after loading', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeSubject()],
    } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
    });
  });

  it('shows "all subjects taught" message when list is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText(/all subjects taught recently/i)).toBeInTheDocument();
    });
  });

  it('shows "never logged" for subjects with null days_since_last_log', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeSubject({ days_since_last_log: null, last_taught_on: null })],
    } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText(/never logged/i)).toBeInTheDocument();
    });
  });

  it('shows days-ago label for subjects with recent logs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeSubject({ days_since_last_log: 15 })],
    } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText(/15 days ago/i)).toBeInTheDocument();
    });
  });

  it('shows child names associated with the subject', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeSubject({ assigned_child_names: ['Alice', 'Bob'] })],
    } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText(/alice, bob/i)).toBeInTheDocument();
    });
  });

  it('caps visible subjects at 5 and shows a "Show more" link', async () => {
    const subjects = Array.from({ length: 7 }, (_, i) =>
      makeSubject({ subject_id: `s${i}`, subject_name: `Subject ${i}` }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => subjects,
    } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByText(/show 2 more/i)).toBeInTheDocument();
    });
    // Only 5 subjects rendered directly
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Subject ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Subject 5')).not.toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('retries fetch when Try again is clicked', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    renderWithProviders(<NeglectedSubjects />);

    await waitFor(() => screen.getByRole('button', { name: /try again/i }));
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText(/all subjects taught recently/i)).toBeInTheDocument();
    });
  });
});
