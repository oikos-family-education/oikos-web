import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import en from '../../messages/en.json';
import { renderWithProviders } from '../utils/renderWithProviders';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  useRouter: () => ({ push: vi.fn(), replace }),
}));

import Home from '../../app/[locale]/page';

function json(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ME = '/api/v1/auth/me';
const REFRESH = '/api/v1/auth/refresh';

/** Answers each URL with the next status in its list. */
function stubApi(answers: Record<string, number[]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const status = answers[url]?.shift();
    if (status === undefined) throw new Error(`unexpected fetch ${url}`);
    return json(status, status === 200 && url === ME ? { user: { id: 'u1' } } : {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: { mock: { calls: unknown[][] } }, url: string) {
  return fetchMock.mock.calls.filter(([u]) => String(u) === url);
}

describe('welcome page session check', () => {
  beforeEach(() => {
    replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('desktop: a parent who is still logged in goes to the dashboard', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const fetchMock = stubApi({ [ME]: [200] });
    renderWithProviders(<Home />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(callsTo(fetchMock, ME)[0][1]).toEqual(expect.objectContaining({ credentials: 'include' }));
    expect(callsTo(fetchMock, REFRESH)).toHaveLength(0);
  });

  it('desktop: an expired access token is refreshed once, then the parent goes to the dashboard', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const fetchMock = stubApi({ [ME]: [401, 200], [REFRESH]: [200] });
    renderWithProviders(<Home />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(callsTo(fetchMock, REFRESH)).toHaveLength(1);
    expect(callsTo(fetchMock, REFRESH)[0][1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('desktop: when the session is gone the welcome page stays, Restore included', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const fetchMock = stubApi({ [ME]: [401], [REFRESH]: [401] });
    renderWithProviders(<Home />);

    await waitFor(() => expect(callsTo(fetchMock, REFRESH)).toHaveLength(1));
    expect(callsTo(fetchMock, ME)).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getAllByText(en.Desktop.restoreButton).length).toBeGreaterThan(0);
  });

  it('desktop: an unreachable API leaves the welcome page as it is', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Home />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getAllByText(en.Desktop.restoreButton).length).toBeGreaterThan(0);
  });

  it('cloud: no session check', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    const fetchMock = stubApi({});
    renderWithProviders(<Home />);

    // Let any effect run before checking that nothing was fetched
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
