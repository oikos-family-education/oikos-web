import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { DashboardJournal } from '../../components/dashboard/DashboardJournal';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('../../components/dashboard/QuickNoteModal', () => ({
  QuickNoteModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? React.createElement('div', { 'data-testid': 'quick-note-modal' },
      React.createElement('button', { onClick: onClose }, 'X')) : null,
}));

const makeJournalEntry = (overrides = {}) => ({
  id: 'j1',
  family_id: 'f1',
  author_user_id: 'u1',
  author_name: 'Alice',
  title: 'My day',
  content: 'Today we did math and reading.',
  status: 'history_only' as const,
  entity_type: null,
  entity_id: null,
  entity_label: null,
  tags: [],
  is_pinned: false,
  due_date: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('DashboardJournal widget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows journal entry title and content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [makeJournalEntry()], total: 1 }),
    } as Response);

    renderWithProviders(<DashboardJournal />);

    await waitFor(() => {
      expect(screen.getByText('My day')).toBeInTheDocument();
      expect(screen.getByText(/math and reading/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response);

    renderWithProviders(<DashboardJournal />);
    await waitFor(() => {
      expect(screen.getByText(/no journal entries/i)).toBeInTheDocument();
    });
  });

  it('shows error state and retry on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<DashboardJournal />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('shows "Today" relative day for today entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [makeJournalEntry()], total: 1 }),
    } as Response);

    renderWithProviders(<DashboardJournal />);
    await waitFor(() => {
      expect(screen.getAllByText(/today/i).length).toBeGreaterThan(0);
    });
  });

  it('shows author name when present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [makeJournalEntry({ author_name: 'Alice' })],
        total: 1,
      }),
    } as Response);

    renderWithProviders(<DashboardJournal />);
    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });
  });

  it('opens the new entry composer when clicking the "New entry" action', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response);

    renderWithProviders(<DashboardJournal />);
    await waitFor(() => screen.getAllByText(/new entry/i)[0]);

    await userEvent.click(screen.getAllByText(/new entry/i)[0]);
    expect(screen.getByTestId('quick-note-modal')).toBeInTheDocument();
  });
});
