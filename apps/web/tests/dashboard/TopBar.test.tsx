import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// v2: NotificationBell uses next-intl + apiFetch which is more than this test
// needs. Stub it out so we keep covering TopBar's own behaviour in isolation.
vi.mock('../../components/community/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell-stub" />,
}));

import { TopBar } from '../../components/dashboard/TopBar';

describe('TopBar', () => {
  it('renders the menu button', () => {
    render(<TopBar onMenuClick={() => {}} />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('calls onMenuClick when the menu button is clicked', () => {
    const onMenuClick = vi.fn();
    render(<TopBar onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(onMenuClick).toHaveBeenCalledOnce();
  });

  it('hides the menu button on large screens (lg:invisible)', () => {
    render(<TopBar onMenuClick={() => {}} />);
    const btn = screen.getByRole('button', { name: /open menu/i });
    expect(btn.className).toContain('lg:invisible');
  });

  it('mounts the notification bell on every page', () => {
    render(<TopBar onMenuClick={() => {}} />);
    expect(screen.getByTestId('notification-bell-stub')).toBeInTheDocument();
  });
});
