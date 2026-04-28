import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { RecentCertificates } from '../../components/dashboard/RecentCertificates';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const makeAchievement = (overrides = {}) => ({
  achievement_id: 'a1',
  child_id: 'c1',
  child_name: 'Alice',
  project_id: 'p1',
  project_title: 'My Science Project',
  completed_at: '2024-06-15T10:00:00Z',
  certificate_number: 'CERT-001',
  ...overrides,
});

describe('RecentCertificates widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when there are no achievements', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    const { container } = renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      // The component returns null when items is empty and not loading
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows achievement child name and project title', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeAchievement()],
    } as Response);

    renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('My Science Project')).toBeInTheDocument();
    });
  });

  it('shows the completion date', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeAchievement()],
    } as Response);

    renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      // Date is formatted as "Completed Jun 15, 2024"
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
      expect(screen.getByText(/jun 15, 2024/i)).toBeInTheDocument();
    });
  });

  it('renders multiple achievements', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        makeAchievement({ achievement_id: 'a1', child_name: 'Alice', project_title: 'Project A' }),
        makeAchievement({ achievement_id: 'a2', child_name: 'Bob', project_title: 'Project B' }),
      ],
    } as Response);

    renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Project A')).toBeInTheDocument();
      expect(screen.getByText('Project B')).toBeInTheDocument();
    });
  });

  it('sets items to empty array and renders nothing on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);

    const { container } = renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      // On failure, items is set to [] → component returns null
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders link pointing to the project', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [makeAchievement({ project_id: 'proj-abc' })],
    } as Response);

    renderWithProviders(<RecentCertificates />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /alice/i });
      expect(link).toHaveAttribute('href', '/projects/proj-abc');
    });
  });
});
