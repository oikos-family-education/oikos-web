/**
 * Tests for LoginForm component.
 *
 * We mock @/lib/navigation (next-intl navigation wrapper) so useRouter()
 * and Link work without a real router, and stub global fetch.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { LoginForm } from '../../components/auth/LoginForm';

const mockPush = vi.fn();

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it('renders the sign in button', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    renderWithProviders(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when email format is invalid', async () => {
    renderWithProviders(<LoginForm />);
    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'not-an-email');
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty on submit', async () => {
    renderWithProviders(<LoginForm />);
    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('submits valid credentials and redirects to /dashboard', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { has_family: true } }),
    } as Response);

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to /onboarding/family when user has no family', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { has_family: false } }),
    } as Response);

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding/family');
    });
  });

  it('shows error message on invalid credentials (401)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' }),
    } as Response);

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'WrongPass123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows account locked error on 423 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 423,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows too many attempts error on 429 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network down'));

    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
