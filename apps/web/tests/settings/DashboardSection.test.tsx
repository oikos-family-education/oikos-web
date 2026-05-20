import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { DashboardSection } from '../../components/settings/DashboardSection';
import type { UiPreferences } from '../../components/settings/AppearanceSection';

const BASE_PREFS: UiPreferences = {
  theme: 'light',
  font_size: 'default',
  reduce_motion: false,
  high_contrast: false,
  dyslexia_font: false,
  neglected_threshold_days: 14,
};

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function setupFetch(): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }),
  );
  return calls;
}

describe('DashboardSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders the initial threshold value', () => {
    setupFetch();
    renderWithProviders(<DashboardSection initial={{ ...BASE_PREFS, neglected_threshold_days: 21 }} />);
    const input = screen.getByLabelText(/days before a subject is flagged/i) as HTMLInputElement;
    expect(input.value).toBe('21');
  });

  it('PATCHes /preferences with the new threshold when a preset is clicked', async () => {
    const calls = setupFetch();
    renderWithProviders(<DashboardSection initial={BASE_PREFS} />);

    await userEvent.click(screen.getByRole('button', { name: /30 days/i }));

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.url.endsWith('/api/v1/users/me/preferences') && c.init?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      const body = JSON.parse(patch!.init!.body as string);
      expect(body).toEqual({ ui_preferences: { neglected_threshold_days: 30 } });
    });
  });

  it('mirrors the updated value to localStorage', async () => {
    setupFetch();
    renderWithProviders(<DashboardSection initial={BASE_PREFS} />);
    await userEvent.click(screen.getByRole('button', { name: /7 days/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('oikos:ui-prefs') || '{}');
      expect(stored.neglected_threshold_days).toBe(7);
    });
  });

  it('rejects out-of-range manual input and shows an error', async () => {
    const calls = setupFetch();
    renderWithProviders(<DashboardSection initial={BASE_PREFS} />);

    const input = screen.getByLabelText(/days before a subject is flagged/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '5000');
    await userEvent.tab(); // blur

    expect(await screen.findByRole('alert')).toHaveTextContent(/between 1 and 365/i);
    // Input should revert to the last known good value (14)
    expect(input.value).toBe('14');
    // No PATCH should have been sent
    const patch = calls.find(
      (c) => c.url.endsWith('/api/v1/users/me/preferences') && c.init?.method === 'PATCH',
    );
    expect(patch).toBeUndefined();
  });

  it('accepts a valid manual input on blur and PATCHes it', async () => {
    const calls = setupFetch();
    renderWithProviders(<DashboardSection initial={BASE_PREFS} />);

    const input = screen.getByLabelText(/days before a subject is flagged/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '45');
    await userEvent.tab();

    await waitFor(() => {
      const patch = calls.find(
        (c) => c.url.endsWith('/api/v1/users/me/preferences') && c.init?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      const body = JSON.parse(patch!.init!.body as string);
      expect(body.ui_preferences.neglected_threshold_days).toBe(45);
    });
  });
});
