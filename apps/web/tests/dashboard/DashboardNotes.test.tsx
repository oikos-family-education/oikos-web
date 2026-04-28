import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { DashboardNotes } from '../../components/dashboard/DashboardNotes';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

// QuickNoteModal is complex; stub it out so we only test DashboardNotes logic.
vi.mock('../../components/dashboard/QuickNoteModal', () => ({
  QuickNoteModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? React.createElement('div', { 'data-testid': 'quick-note-modal' },
      React.createElement('button', { onClick: onClose }, 'Close modal')
    ) : null,
}));

const makeNote = (overrides = {}) => ({
  id: 'n1',
  family_id: 'f1',
  author_user_id: null,
  author_name: null,
  title: 'Buy books',
  content: 'Get science books',
  status: 'todo' as const,
  entity_type: null,
  entity_id: null,
  entity_label: null,
  tags: [],
  is_pinned: false,
  due_date: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('DashboardNotes widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the three columns (To Do, In Progress, To Remember)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('To Remember')).toBeInTheDocument();
    });
  });

  it('shows a note title in the correct column', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [makeNote({ status: 'todo', title: 'Buy books' })], total: 1 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByText('Buy books')).toBeInTheDocument();
    });
  });

  it('distributes notes into the correct columns', async () => {
    const notes = [
      makeNote({ id: 'n1', title: 'Task A', status: 'todo' }),
      makeNote({ id: 'n2', title: 'Task B', status: 'in_progress' }),
      makeNote({ id: 'n3', title: 'Task C', status: 'to_remember' }),
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: notes, total: 3 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
      expect(screen.getByText('Task C')).toBeInTheDocument();
    });
  });

  it('shows empty column placeholder text when a column has no notes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      const empties = screen.getAllByText(/empty/i);
      expect(empties.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('opens QuickNoteModal when "Add task" is clicked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByText('Add task')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Add task'));

    expect(screen.getByTestId('quick-note-modal')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('caps column at 5 items and shows "+N more" link', async () => {
    const notes = Array.from({ length: 7 }, (_, i) =>
      makeNote({ id: `n${i}`, title: `Task ${i}`, status: 'todo' }),
    );
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: notes, total: 7 }),
    } as Response);

    renderWithProviders(<DashboardNotes />);

    await waitFor(() => {
      expect(screen.getByText(/\+2 more/i)).toBeInTheDocument();
    });
    // Only 5 tasks visible in the to-do column
    expect(screen.getByText('Task 0')).toBeInTheDocument();
    expect(screen.getByText('Task 4')).toBeInTheDocument();
    expect(screen.queryByText('Task 5')).not.toBeInTheDocument();
  });
});
