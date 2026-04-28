import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { DashboardHero } from '../../components/dashboard/DashboardHero';

const mockUser = {
  id: 'u1',
  email: 'a@b.com',
  first_name: 'Alice',
  last_name: 'Smith',
  has_family: true,
  has_coat_of_arms: false,
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
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

let authValue: { user: any; family: any; isLoading: boolean; logout: () => Promise<void> } = {
  user: mockUser,
  family: mockFamily,
  isLoading: false,
  logout: async () => {},
};

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

// Replace heavy modal children with stubs
vi.mock('../../components/dashboard/QuickProgressModal', () => ({
  QuickProgressModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="progress-modal" /> : null,
}));
vi.mock('../../components/dashboard/QuickNoteModal', () => ({
  QuickNoteModal: ({ open }: { open: boolean }) => (open ? <div data-testid="note-modal" /> : null),
}));
vi.mock('../../components/dashboard/QuickEventModal', () => ({
  QuickEventModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="event-modal" /> : null,
}));

// Stub ShieldPreview (heavy SVG)
vi.mock('../../components/onboarding/ShieldPreview', () => ({
  ShieldPreview: ({ familyName }: { familyName: string }) => (
    <div data-testid="shield-preview">{familyName}</div>
  ),
}));

describe('DashboardHero', () => {
  beforeEach(() => {
    authValue = {
      user: mockUser,
      family: mockFamily,
      isLoading: false,
      logout: async () => {},
    };
  });

  it('renders the family name as the main heading', () => {
    renderWithProviders(<DashboardHero />);
    expect(screen.getByRole('heading', { name: 'Smith Family' })).toBeInTheDocument();
  });

  it('renders 3 quick action buttons', () => {
    renderWithProviders(<DashboardHero />);
    expect(screen.getByRole('button', { name: /log progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument();
  });

  it('shows greeting after mount', async () => {
    renderWithProviders(<DashboardHero />);
    await waitFor(() => {
      // greeting always contains the name (or family name) — appears in heading + greeting paragraph
      expect(screen.getAllByText(/Alice|Smith Family/).length).toBeGreaterThan(0);
    });
  });

  it('shows "Setup shield" link when user has no coat of arms', () => {
    renderWithProviders(<DashboardHero />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/family');
  });

  it('hides setup shield link when user has coat of arms and shield_config is set', () => {
    authValue = {
      ...authValue,
      user: { ...mockUser, has_coat_of_arms: true },
      family: { ...mockFamily, shield_config: { initials: 'SF' } as any },
    };
    renderWithProviders(<DashboardHero />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the ShieldPreview when user has shield', () => {
    authValue = {
      ...authValue,
      user: { ...mockUser, has_coat_of_arms: true },
      family: { ...mockFamily, shield_config: { initials: 'SF' } as any },
    };
    renderWithProviders(<DashboardHero />);
    expect(screen.getByTestId('shield-preview')).toBeInTheDocument();
  });

  it('opens progress modal when "Log Progress" clicked', () => {
    renderWithProviders(<DashboardHero />);
    fireEvent.click(screen.getByRole('button', { name: /log progress/i }));
    expect(screen.getByTestId('progress-modal')).toBeInTheDocument();
  });

  it('opens note modal when "New Note" clicked', () => {
    renderWithProviders(<DashboardHero />);
    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    expect(screen.getByTestId('note-modal')).toBeInTheDocument();
  });

  it('opens event modal when "Add Event" clicked', () => {
    renderWithProviders(<DashboardHero />);
    fireEvent.click(screen.getByRole('button', { name: /add event/i }));
    expect(screen.getByTestId('event-modal')).toBeInTheDocument();
  });

  it('falls back to "Your Family" when family is null', () => {
    authValue = { user: mockUser, family: null, isLoading: false, logout: async () => {} };
    renderWithProviders(<DashboardHero />);
    expect(screen.getByRole('heading', { name: 'Your Family' })).toBeInTheDocument();
  });
});
