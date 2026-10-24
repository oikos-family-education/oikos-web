import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { LocalResetPasswordForm } from '../../components/auth/LocalResetPasswordForm';
import ForgotPasswordPage from '../../app/[locale]/(auth)/forgot-password/page';

const mockPush = vi.fn();

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const fillAndSubmit = async (email = 'ana@example.com', pw = 'StrongPass1!', confirm = pw) => {
  await userEvent.clear(screen.getByLabelText(/email/i));
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/^new password/i), pw);
  await userEvent.type(screen.getByLabelText(/confirm new password/i), confirm);
  fireEvent.click(screen.getByRole('button', { name: /save and log in/i }));
};

describe('LocalResetPasswordForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders the default title, fields and submit button', () => {
    renderWithProviders(<LocalResetPasswordForm />);
    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and log in/i })).toBeInTheDocument();
  });

  it('uses a custom title when given', () => {
    renderWithProviders(<LocalResetPasswordForm title="Backup restored" />);
    expect(screen.getByRole('heading', { name: 'Backup restored' })).toBeInTheDocument();
  });

  it('prefills initialEmail', () => {
    renderWithProviders(<LocalResetPasswordForm initialEmail="ana@example.com" />);
    expect(screen.getByLabelText(/email/i)).toHaveValue('ana@example.com');
  });

  it('submits and redirects to the dashboard', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { locale: 'en' } }),
    } as Response);

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard', { locale: 'en' }));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/v1/auth/local-reset-password');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'ana@example.com',
      new_password: 'StrongPass1!',
      confirm_password: 'StrongPass1!',
    });
  });

  it('redirects to plain /dashboard when the response carries no known locale', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: {} }) } as Response);

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows accountNotFound on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: { detail: 'No account with that email.', code: 'account_not_found' } }),
    } as Response);

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("There's no account with that email on this computer.");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the rate-limit message on 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ detail: 'Too many requests' }),
    } as Response);

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i);
    });
  });

  it('shows a generic error on other failures (e.g. 403) and on network errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: { code: 'bad_origin' } }),
    } as Response);

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    });
  });

  it('shows a generic error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<LocalResetPasswordForm />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    });
  });

  it('validates min length on blur', async () => {
    renderWithProviders(<LocalResetPasswordForm />);
    const pw = screen.getByLabelText(/^new password/i);
    await userEvent.type(pw, 'short');
    fireEvent.blur(pw);
    await waitFor(() => {
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('validates that the passwords match on blur', async () => {
    renderWithProviders(<LocalResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'StrongPass1!');
    const confirm = screen.getByLabelText(/confirm new password/i);
    await userEvent.type(confirm, 'Different1!');
    fireEvent.blur(confirm);
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('validates the email on blur', async () => {
    renderWithProviders(<LocalResetPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await userEvent.type(email, 'not-an-email');
    fireEvent.blur(email);
    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('forgot-password page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the desktop form only in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const { unmount } = renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByRole('button', { name: /save and log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
    unmount();

    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save and log in/i })).not.toBeInTheDocument();
  });
});
