import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from '../../messages/en.json';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { CloudOnlyDialog } from '../../components/desktop/CloudOnlyDialog';
import { CloudOnlyPage } from '../../components/desktop/CloudOnlyPage';
import { CloudOnlyRouteGuard } from '../../components/desktop/CloudOnlyRouteGuard';
import { Sidebar } from '../../components/dashboard/Sidebar';
import { NotificationBell } from '../../components/community/NotificationBell';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CloudOnlyDialog', () => {
  it('shows the title and body and closes on OK', () => {
    const onClose = vi.fn();
    renderWithProviders(<CloudOnlyDialog open onClose={onClose} />);
    expect(screen.getByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
    expect(screen.getByText(en.Desktop.cloudOnlyBody)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.Desktop.cloudOnlyOk }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<CloudOnlyDialog open={false} onClose={() => {}} />);
    expect(screen.queryByText(en.Desktop.cloudOnlyTitle)).toBeNull();
  });
});

describe('CloudOnlyPage', () => {
  it('shows the page title and body', () => {
    renderWithProviders(<CloudOnlyPage />);
    expect(screen.getByText(en.Desktop.cloudOnlyPageTitle)).toBeInTheDocument();
    expect(screen.getByText(en.Desktop.cloudOnlyBody)).toBeInTheDocument();
  });
});

describe('CloudOnlyRouteGuard', () => {
  it('shows the cloud-only page in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    renderWithProviders(<CloudOnlyRouteGuard><p>secret</p></CloudOnlyRouteGuard>);
    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.getByText(en.Desktop.cloudOnlyPageTitle)).toBeInTheDocument();
  });

  it('renders children in cloud mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    renderWithProviders(<CloudOnlyRouteGuard><p>secret</p></CloudOnlyRouteGuard>);
    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(screen.queryByText(en.Desktop.cloudOnlyPageTitle)).toBeNull();
  });
});

describe('desktop mode gating', () => {
  it('Sidebar and bell make no cloud-only requests in desktop mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    renderWithProviders(
      <>
        <Sidebar mobileOpen={false} onMobileClose={() => {}} />
        <NotificationBell />
      </>,
    );
    await new Promise((r) => setTimeout(r, 0));
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => /communities|messages|notifications/.test(u))).toEqual([]);
  });

  it('the bell opens the cloud-only dialog in desktop mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    renderWithProviders(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: en.Notifications.bellTitle }));
    expect(screen.getByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.Notifications.empty)).toBeNull();
  });

  it('cloud mode still polls the cloud endpoints', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"count":0,"threads":0}', { status: 200 }));
    renderWithProviders(
      <>
        <Sidebar mobileOpen={false} onMobileClose={() => {}} />
        <NotificationBell />
      </>,
    );
    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('communities/admin-pending-count'))).toBe(true);
      expect(urls.some((u) => u.includes('messages/unread-count'))).toBe(true);
      expect(urls.some((u) => u.includes('notifications/unread-count'))).toBe(true);
    });
  });
});
