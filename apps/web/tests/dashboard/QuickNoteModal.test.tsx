import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { QuickNoteModal } from '../../components/dashboard/QuickNoteModal';

describe('QuickNoteModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render when closed', () => {
    renderWithProviders(<QuickNoteModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and content textarea when open', () => {
    renderWithProviders(<QuickNoteModal open onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/what's on your mind/i)).toBeInTheDocument();
  });

  it('shows error when submitting empty content', async () => {
    renderWithProviders(<QuickNoteModal open onClose={() => {}} />);
    const submit = screen.getByRole('button', { name: /save|submit/i });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits valid content and calls onClose + onCreated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const onClose = vi.fn();
    const onCreated = vi.fn();

    renderWithProviders(<QuickNoteModal open onClose={onClose} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(/what's on your mind/i), 'Test note');
    fireEvent.click(screen.getByRole('button', { name: /save|submit/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('parses tags into an array, splitting by comma and trimming', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    renderWithProviders(<QuickNoteModal open onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText(/what's on your mind/i), 'My note');
    await userEvent.type(screen.getByLabelText(/tags|tag/i), '  urgent ,  school  ,');

    fireEvent.click(screen.getByRole('button', { name: /save|submit/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.tags).toEqual(['urgent', 'school']);
  });

  it('shows server error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Custom server error' }),
    } as Response);

    renderWithProviders(<QuickNoteModal open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/what's on your mind/i), 'My note');
    fireEvent.click(screen.getByRole('button', { name: /save|submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/custom server error/i)).toBeInTheDocument();
    });
  });

  it('shows generic error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<QuickNoteModal open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/what's on your mind/i), 'My note');
    fireEvent.click(screen.getByRole('button', { name: /save|submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not create/i)).toBeInTheDocument();
    });
  });

  it('uses defaultStatus prop on initial render', () => {
    renderWithProviders(<QuickNoteModal open onClose={() => {}} defaultStatus="in_progress" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('in_progress');
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<QuickNoteModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
