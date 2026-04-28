import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { QuickEventModal } from '../../components/dashboard/QuickEventModal';

describe('QuickEventModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render when closed', () => {
    renderWithProviders(<QuickEventModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title input when open', () => {
    renderWithProviders(<QuickEventModal open onClose={() => {}} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('shows error when submitting without title', async () => {
    renderWithProviders(<QuickEventModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /create|add|save/i }));
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits a valid event and calls onCreated + onClose', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const onCreated = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(<QuickEventModal open onClose={onClose} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(/title/i), 'Birthday party');
    fireEvent.click(screen.getByRole('button', { name: /create|add|save/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.title).toBe('Birthday party');
    expect(body.event_type).toBe('family');
    expect(body.recurrence).toBe('none');
  });

  it('shows error on non-ok response with detail message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Invalid event date' }),
    } as Response);

    renderWithProviders(<QuickEventModal open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Bad event');
    fireEvent.click(screen.getByRole('button', { name: /create|add|save/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid event date/i)).toBeInTheDocument();
    });
  });

  it('shows generic error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network'));

    renderWithProviders(<QuickEventModal open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Bad event');
    fireEvent.click(screen.getByRole('button', { name: /create|add|save/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not create/i)).toBeInTheDocument();
    });
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<QuickEventModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
