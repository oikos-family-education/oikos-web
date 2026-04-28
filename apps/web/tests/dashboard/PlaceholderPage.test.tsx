import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Construction } from 'lucide-react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { PlaceholderPage } from '../../components/dashboard/PlaceholderPage';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

describe('PlaceholderPage', () => {
  it('renders the title', () => {
    renderWithProviders(<PlaceholderPage title="Coming Soon!" description="d" icon={Construction} />);
    expect(screen.getByRole('heading', { name: 'Coming Soon!' })).toBeInTheDocument();
  });

  it('renders the description', () => {
    renderWithProviders(
      <PlaceholderPage title="t" description="A long description here" icon={Construction} />,
    );
    expect(screen.getByText('A long description here')).toBeInTheDocument();
  });

  it('renders a link back to /dashboard', () => {
    renderWithProviders(<PlaceholderPage title="t" description="d" icon={Construction} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});
