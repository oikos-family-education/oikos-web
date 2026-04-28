import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders email field and submit button', () => {
    renderWithProviders(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows email-required validation error on empty submit', async () => {
    renderWithProviders(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('shows email-invalid validation error on bad format', async () => {
    renderWithProviders(<ForgotPasswordForm />);
    const input = screen.getByLabelText(/email/i);
    await userEvent.type(input, 'not-an-email');
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('shows success state after successful submission', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it('shows error alert on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error alert when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls the correct API endpoint with the email', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/v1/auth/forgot-password',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.email).toBe('user@example.com');
  });
});
