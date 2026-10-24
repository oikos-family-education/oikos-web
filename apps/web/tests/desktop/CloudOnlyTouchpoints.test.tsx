import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import en from '../../messages/en.json';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { DashboardCommunities } from '../../components/dashboard/DashboardCommunities';
import { MembersTab } from '../../components/family/tabs/MembersTab';
import { PrivacyTab } from '../../components/family/tabs/PrivacyTab';
import { FamilyWizard } from '../../components/onboarding/FamilyWizard';
import { buildDefaultFormData, type FamilyApiResponse } from '../../components/family/familyFormTypes';
import Home from '../../app/[locale]/page';

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const primary = {
  kind: 'member',
  id: 'm1',
  user_id: 'u1',
  email: 'ana@example.com',
  has_account: true,
  first_name: 'Ana',
  last_name: 'Silva',
  role: 'primary',
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
  invited_at: null,
  expires_at: null,
};

const pendingInvite = {
  ...primary,
  kind: 'invitation',
  id: 'i1',
  user_id: null,
  email: 'pedro@example.com',
  has_account: false,
  first_name: null,
  last_name: null,
  role: 'co_parent',
  status: 'pending',
  invited_at: '2026-02-01T00:00:00Z',
  expires_at: '2026-02-08T00:00:00Z',
};

function stubFetch(members: unknown[] = []) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === '/api/v1/families/me/members') return mockResponse(members);
    return mockResponse([]);
  });
}

function callsTo(fragment: string) {
  return vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes(fragment));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DashboardCommunities', () => {
  it('shows the static card and does not fetch in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    stubFetch();
    renderWithProviders(<DashboardCommunities />);

    expect(screen.getByText(en.Desktop.communitiesCardTitle)).toBeInTheDocument();
    expect(screen.getByText(en.Desktop.communitiesCardBody)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is unchanged in cloud mode: fetches the summary and renders its widget', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    stubFetch();
    renderWithProviders(<DashboardCommunities />);

    expect(await screen.findByText(en.DashboardCommunities.empty)).toBeInTheDocument();
    expect(callsTo('/api/v1/communities/dashboard-summary')).toHaveLength(1);
    expect(screen.queryByText(en.Desktop.communitiesCardBody)).toBeNull();
  });
});

describe('MembersTab invitations', () => {
  async function fillAndSubmitInvite() {
    fireEvent.change(await screen.findByPlaceholderText(en.Family.inviteEmailPlaceholder), {
      target: { value: 'pedro@example.com' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: en.Family.inviteButton }));
  }

  it('opens the dialog instead of POSTing the invite in desktop mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    stubFetch([primary]);
    renderWithProviders(<MembersTab />);

    await fillAndSubmitInvite();

    expect(await screen.findByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
    expect(callsTo('/members/invite')).toHaveLength(0);
  });

  it('opens the dialog for resend and revoke in desktop mode without calling the API', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    stubFetch([primary, pendingInvite]);
    renderWithProviders(<MembersTab />);

    fireEvent.click(await screen.findByRole('button', { name: en.Family.membersResend }));
    expect(await screen.findByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.Desktop.cloudOnlyOk }));
    await waitFor(() => expect(screen.queryByText(en.Desktop.cloudOnlyTitle)).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: en.Family.membersCancelInvite }));
    expect(await screen.findByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
    expect(callsTo('/members/invite')).toHaveLength(0);
  });

  it('is unchanged in cloud mode: POSTs the invite and shows no dialog', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    stubFetch([primary]);
    renderWithProviders(<MembersTab />);

    await fillAndSubmitInvite();

    await waitFor(() => expect(callsTo('/members/invite')).toHaveLength(1));
    expect(screen.queryByText(en.Desktop.cloudOnlyTitle)).toBeNull();
  });

  it('is unchanged in cloud mode: resend calls the API', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    stubFetch([primary, pendingInvite]);
    renderWithProviders(<MembersTab />);

    fireEvent.click(await screen.findByRole('button', { name: en.Family.membersResend }));

    await waitFor(() => expect(callsTo('/members/invite/i1/resend')).toHaveLength(1));
    expect(screen.queryByText(en.Desktop.cloudOnlyTitle)).toBeNull();
  });
});

describe('PrivacyTab visibility', () => {
  const family = { id: 'f1', family_name: 'Silva', visibility: 'local' } as unknown as FamilyApiResponse;
  const formData = { ...buildDefaultFormData(), family_name: 'Silva' };

  function renderTab() {
    return renderWithProviders(<PrivacyTab family={family} formData={formData} onFamilyUpdated={() => {}} />);
  }

  it('disables the visibility options and shows the online-only note in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    renderTab();

    expect(screen.getByText(en.Desktop.onlineOnlyNote)).toBeInTheDocument();
    for (const label of ['Local', 'Private', 'Public']) {
      expect(screen.getByText(label).closest('button')).toBeDisabled();
    }
  });

  it('is unchanged in cloud mode: options are enabled and there is no note', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    renderTab();

    expect(screen.queryByText(en.Desktop.onlineOnlyNote)).toBeNull();
    for (const label of ['Local', 'Private', 'Public']) {
      expect(screen.getByText(label).closest('button')).toBeEnabled();
    }
  });
});

describe('FamilyWizard step 3 visibility', () => {
  function goToStep3() {
    renderWithProviders(<FamilyWizard />);
    fireEvent.change(screen.getByPlaceholderText(en.Onboarding.familyNamePlaceholder), {
      target: { value: 'Silva' },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.Onboarding.next) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.Onboarding.next) }));
  }

  it('hides the visibility choice in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    goToStep3();

    expect(screen.getByText(en.Onboarding.step3Heading)).toBeInTheDocument();
    expect(screen.queryByText(en.Onboarding.visibilityLabel)).toBeNull();
  });

  it('is unchanged in cloud mode: the visibility choice is shown', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    goToStep3();

    expect(screen.getByText(en.Onboarding.visibilityLabel)).toBeInTheDocument();
  });
});

describe('Landing beta call to action', () => {
  it('opens the dialog instead of navigating in desktop mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    renderWithProviders(<Home />);

    expect(screen.queryByRole('link', { name: en.Landing.betaCta })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.Landing.betaCta }));
    expect(await screen.findByText(en.Desktop.cloudOnlyTitle)).toBeInTheDocument();
  });

  it('is unchanged in cloud mode: a link to /beta', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    renderWithProviders(<Home />);

    expect(screen.getByRole('link', { name: en.Landing.betaCta })).toHaveAttribute('href', '/beta');
    expect(screen.queryByRole('button', { name: en.Landing.betaCta })).toBeNull();
  });
});
