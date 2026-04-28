import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { QuickProgressModal } from '../../components/dashboard/QuickProgressModal';

describe('QuickProgressModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render when closed', () => {
    renderWithProviders(<QuickProgressModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads children and subjects when opened', async () => {
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (typeof url === 'string' && url.includes('/children')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'c1', first_name: 'Alice', nickname: null }],
        } as Response);
      }
      if (typeof url === 'string' && url.includes('/subjects')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 's1', name: 'Mathematics', color: '#000' }],
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }) as any);

    renderWithProviders(<QuickProgressModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
    });
  });

  it('uses nickname when present, else first_name', async () => {
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (typeof url === 'string' && url.includes('/children')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'c1', first_name: 'Alice', nickname: 'Allie' }],
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }) as any);

    renderWithProviders(<QuickProgressModal open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Allie')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('submits a progress log with the right payload', async () => {
    vi.mocked(fetch).mockImplementation(((url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/progress/logs')) {
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }) as any);

    const onLogged = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(<QuickProgressModal open onClose={onClose} onLogged={onLogged} />);

    await userEvent.type(screen.getByLabelText(/duration/i), '30');
    fireEvent.click(screen.getByRole('button', { name: /log/i }));

    await waitFor(() => {
      expect(onLogged).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    const logCall = vi.mocked(fetch).mock.calls.find((c) =>
      String(c[0]).includes('/progress/logs'),
    );
    expect(logCall).toBeDefined();
    const body = JSON.parse(logCall![1]?.body as string);
    expect(body.minutes).toBe(30);
    expect(body.taught_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows error on non-ok response', async () => {
    vi.mocked(fetch).mockImplementation(((url: string) => {
      if (typeof url === 'string' && url.includes('/progress/logs')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: 'Validation error' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }) as any);

    renderWithProviders(<QuickProgressModal open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /log/i }));

    await waitFor(() => {
      expect(screen.getByText(/validation error/i)).toBeInTheDocument();
    });
  });

  it('cancel button calls onClose', () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const onClose = vi.fn();

    renderWithProviders(<QuickProgressModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
