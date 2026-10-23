import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { MembersTab } from '../../components/family/tabs/MembersTab';

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

const profile = {
  ...primary,
  id: 'm2',
  user_id: null,
  email: null,
  has_account: false,
  first_name: 'Pedro',
  last_name: null,
  role: 'co_parent',
};

function stubMembers(members: unknown[]) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === '/api/v1/families/me/members/profiles' && init?.method === 'POST') {
      return mockResponse(profile, true, 201);
    }
    return mockResponse(members);
  });
}

describe('MembersTab — parents without an account', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers to add the other parent when there is no co-parent', async () => {
    stubMembers([primary]);
    renderWithProviders(<MembersTab />);

    expect(await screen.findByText('Add the other parent')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: ' Pedro ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add parent' }));

    await waitFor(() => {
      const post = vi.mocked(fetch).mock.calls.find(
        ([u, init]) => u === '/api/v1/families/me/members/profiles' && init?.method === 'POST',
      );
      expect(post).toBeDefined();
      expect(JSON.parse(post![1]!.body as string)).toEqual({ first_name: 'Pedro', last_name: null });
    });
  });

  it('lists a parent without an account and still allows inviting them', async () => {
    stubMembers([primary, profile]);
    renderWithProviders(<MembersTab />);

    expect(await screen.findByText('Pedro')).toBeInTheDocument();
    expect(screen.getByText('No login, listed for planning only')).toBeInTheDocument();
    expect(screen.queryByText('Add the other parent')).not.toBeInTheDocument();
    expect(screen.getByText('Invite a second parent or educator')).toBeInTheDocument();
    expect(screen.getByText(/When Pedro accepts/)).toBeInTheDocument();
  });

  it('removes a parent without an account through the profile endpoint', async () => {
    stubMembers([primary, profile]);
    renderWithProviders(<MembersTab />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove Pedro?')).toBeInTheDocument();
    const dialogButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(
        ([u, init]) => u === '/api/v1/families/me/members/profiles/m2' && init?.method === 'DELETE',
      )).toBe(true);
    });
  });
});
