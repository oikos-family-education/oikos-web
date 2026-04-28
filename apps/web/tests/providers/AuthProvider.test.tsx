/**
 * Tests for AuthProvider.
 *
 * The provider makes fetch calls to /api/v1/auth/me and /api/v1/families/me,
 * and uses useRouter() from our navigation lib. We stub both.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../providers/AuthProvider';

const mockReplace = vi.fn();

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Helper consumer component that exposes auth context values
function AuthConsumer() {
  const { user, family, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>No user</div>;
  return (
    <div>
      <div data-testid="user-email">{user.email}</div>
      <div data-testid="family-name">{family?.family_name ?? 'no-family'}</div>
    </div>
  );
}

const mockUser = {
  id: 'u1',
  email: 'alice@example.com',
  first_name: 'Alice',
  last_name: 'Smith',
  has_family: true,
  has_coat_of_arms: true,
};

const mockFamily = {
  id: 'f1',
  family_name: 'Smith Family',
  family_name_slug: 'smith-family',
  shield_config: null,
  location_city: null,
  location_country: null,
  faith_tradition: null,
  education_purpose: null,
  education_methods: [],
  visibility: 'private',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockReplace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading state initially', () => {
    // Never resolves — we just check the initial render
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders children with user and family data on successful auth', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFamily,
      } as Response);

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('alice@example.com');
    });
    expect(screen.getByTestId('family-name')).toHaveTextContent('Smith Family');
  });

  it('redirects to /login when /auth/me returns 401 and refresh fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // me
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // refresh
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response); // me again

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when /auth/me returns non-ok (non-401)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /onboarding/family when user has no family', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { ...mockUser, has_family: false } }),
    } as Response);

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/family');
    });
  });

  it('redirects to /onboarding/coat-of-arms when user has no coat of arms', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { ...mockUser, has_coat_of_arms: false } }),
    } as Response);

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/coat-of-arms');
    });
  });

  it('redirects to /login when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('calls logout endpoint and redirects to /login', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFamily,
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response); // logout

    function LogoutButton() {
      const { logout, isLoading } = useAuth();
      if (isLoading) return <div>Loading...</div>;
      return <button onClick={logout}>Logout</button>;
    }

    render(<AuthProvider><LogoutButton /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('retries /auth/me after a successful refresh', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // first /me → 401
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response) // refresh ok
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as Response) // second /me → ok
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFamily,
      } as Response); // /families/me

    render(<AuthProvider><AuthConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('alice@example.com');
    });
    // Should have called /me twice (initial + after refresh)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
  });
});
