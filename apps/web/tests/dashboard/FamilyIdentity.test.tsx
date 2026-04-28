import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { FamilyIdentity } from '../../components/dashboard/FamilyIdentity';

const logoutMock = vi.fn();

let authValue: { user: any; family: any; isLoading: boolean; logout: () => Promise<void> } = {
  user: { has_coat_of_arms: true },
  family: { family_name: 'Smith Family', shield_config: null },
  isLoading: false,
  logout: logoutMock,
};

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, onClick, ...rest }: any) =>
    React.createElement('a', { href, onClick, ...rest }, children),
}));

vi.mock('../../components/onboarding/ShieldPreview', () => ({
  ShieldPreview: ({ familyName }: { familyName: string }) => (
    <div data-testid="shield-preview">{familyName}</div>
  ),
}));

describe('FamilyIdentity', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    authValue = {
      user: { has_coat_of_arms: true },
      family: { family_name: 'Smith Family', shield_config: null },
      isLoading: false,
      logout: logoutMock,
    };
  });

  it('renders the family name when not collapsed', () => {
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    // The family name appears in both the shield preview (mocked) and the visible label
    expect(screen.getAllByText('Smith Family').length).toBeGreaterThanOrEqual(1);
  });

  it('hides family name in collapsed mode but uses it as title', () => {
    renderWithProviders(<FamilyIdentity collapsed />);
    // ShieldPreview still gets the family name (testid)
    expect(screen.getByTestId('shield-preview')).toBeInTheDocument();
    // The button title should be the family name
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Smith Family');
  });

  it('falls back to "My Family" when family is missing', () => {
    authValue = { ...authValue, family: null };
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    expect(screen.getAllByText('My Family').length).toBeGreaterThanOrEqual(1);
  });

  it('opens menu on click and shows logout button', async () => {
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    expect(screen.getByText(/family profile/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it('logout calls the logout function', async () => {
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    await userEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText(/sign out/i));
    expect(logoutMock).toHaveBeenCalledOnce();
  });

  it('clicking outside the menu closes it', async () => {
    renderWithProviders(
      <div>
        <FamilyIdentity collapsed={false} />
        <button>Outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /smith family/i }));
    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
  });

  it('Family Profile link points to /family', async () => {
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    await userEvent.click(screen.getByRole('button'));
    const link = screen.getByText(/family profile/i).closest('a');
    expect(link).toHaveAttribute('href', '/family');
  });

  it('Settings link points to /settings', async () => {
    renderWithProviders(<FamilyIdentity collapsed={false} />);
    await userEvent.click(screen.getByRole('button'));
    const link = screen.getByText(/settings/i).closest('a');
    expect(link).toHaveAttribute('href', '/settings');
  });
});
