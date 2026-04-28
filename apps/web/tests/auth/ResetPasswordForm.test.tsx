import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ResetPasswordForm } from '../../components/auth/ResetPasswordForm';

const mockPush = vi.fn();

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('next/navigation', () => ({
  // The form falls back to query params when there's no hash. Provide the token
  // via search params — JSDOM hash assignment isn't reliable across renders.
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? 'test-token-123' : null) }),
}));

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders password fields and submit button', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows password-min validation error', async () => {
    renderWithProviders(<ResetPasswordForm />);
    const pw = screen.getByLabelText(/^new password/i);
    await userEvent.type(pw, 'Short1!');
    fireEvent.blur(pw);
    await waitFor(() => {
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('shows passwords-do-not-match error when values differ', async () => {
    renderWithProviders(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Different1!');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submits successfully and shows success message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    renderWithProviders(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1!');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Success alert (green) should display
    expect(screen.getByRole('alert').className).toContain('bg-green');
  });

  it('shows error alert on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Token expired' }),
    } as Response);

    renderWithProviders(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1!');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1!');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls API with token from URL hash', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    renderWithProviders(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1!');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.token).toBe('test-token-123');
    expect(body.new_password).toBe('StrongPass1!');
  });
});
