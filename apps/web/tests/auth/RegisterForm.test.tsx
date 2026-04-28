/**
 * Tests for RegisterForm component.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { RegisterForm } from '../../components/auth/RegisterForm';

const mockPush = vi.fn();

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all required fields', () => {
    renderWithProviders(<RegisterForm />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders the create account button', () => {
    renderWithProviders(<RegisterForm />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows error when first name is empty on submit', async () => {
    renderWithProviders(<RegisterForm />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    });
  });

  it('shows email validation error for invalid format', async () => {
    renderWithProviders(<RegisterForm />);
    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'not-an-email');
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('shows password minimum length error', async () => {
    renderWithProviders(<RegisterForm />);
    const pwInput = screen.getByLabelText(/^password/i);
    await userEvent.type(pwInput, 'Short1!');
    fireEvent.blur(pwInput);
    await waitFor(() => {
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    renderWithProviders(<RegisterForm />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'DifferentPass1!');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submits valid form and redirects to /onboarding/family', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user-1', email: 'jane@example.com' }),
    } as Response);

    renderWithProviders(<RegisterForm />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'StrongPass1!');
    await userEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding/family');
    });
  });

  it('shows account-exists error on 409 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    } as Response);

    renderWithProviders(<RegisterForm />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'StrongPass1!');
    await userEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it('shows generic error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<RegisterForm />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'StrongPass1!');
    await userEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('requires terms checkbox to be checked', async () => {
    renderWithProviders(<RegisterForm />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'StrongPass1!');
    // do NOT check the terms checkbox

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/agree to the terms/i)).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
