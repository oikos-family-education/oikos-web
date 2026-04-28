import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { SidebarNavItem } from '../../components/dashboard/SidebarNavItem';

let mockPathname = '/dashboard';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  usePathname: () => mockPathname,
}));

describe('SidebarNavItem', () => {
  it('renders the label and an icon', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed={false} />);
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/family');
  });

  it('hides the label when collapsed', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed />);
    expect(screen.queryByText('Family')).not.toBeInTheDocument();
  });

  it('uses the collapsed title for tooltip when collapsed', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed />);
    expect(screen.getByRole('link')).toHaveAttribute('title', 'Family');
  });

  it('marks active when pathname matches href exactly', () => {
    mockPathname = '/family';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed={false} />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('text-primary');
  });

  it('marks active when pathname starts with href + /', () => {
    mockPathname = '/family/edit';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed={false} />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('text-primary');
  });

  it('does not mark active when pathname is unrelated', () => {
    mockPathname = '/other';
    render(<SidebarNavItem href="/family" label="Family" icon={Home} collapsed={false} />);
    const link = screen.getByRole('link');
    expect(link.className).not.toContain('text-primary font-semibold');
  });

  it('shows "Soon" pill when soon=true and not collapsed', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/x" label="Future" icon={Home} collapsed={false} soon />);
    expect(screen.getByText('Soon')).toBeInTheDocument();
  });

  it('uses "(coming soon)" aria-label when soon=true', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/x" label="Future" icon={Home} collapsed={false} soon />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Future (coming soon)');
  });

  it('appends "(Soon)" to the title when collapsed and soon', () => {
    mockPathname = '/dashboard';
    render(<SidebarNavItem href="/x" label="Future" icon={Home} collapsed soon />);
    expect(screen.getByRole('link')).toHaveAttribute('title', 'Future (Soon)');
  });
});
