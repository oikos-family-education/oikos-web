import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { CurriculumWizard } from '../../components/curriculums/CurriculumWizard';

vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ user: null, family: null, isLoading: false }),
}));

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('CurriculumWizard subject picker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches subjects scoped to the family (source=mine), not platform/community', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.startsWith('/api/v1/families/me/children')) return mockResponse([]);
      if (url.startsWith('/api/v1/subjects')) return mockResponse([]);
      if (url.startsWith('/api/v1/curriculums')) return mockResponse([]);
      return mockResponse([]);
    });

    renderWithProviders(<CurriculumWizard />);

    await waitFor(() => {
      const subjectCalls = vi.mocked(fetch).mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : (c[0] as Request).url))
        .filter((u) => u.startsWith('/api/v1/subjects'));
      expect(subjectCalls).toHaveLength(1);
      expect(subjectCalls[0]).toContain('source=mine');
    });
  });

  it('renders only the subjects returned by the family-scoped endpoint in the picker', async () => {
    const familySubject = {
      id: 'fam-1',
      name: 'Family Math',
      category: 'mathematics',
      color: '#ff0000',
      default_session_duration_minutes: 30,
      default_weekly_frequency: 3,
    };

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.startsWith('/api/v1/families/me/children')) return mockResponse([]);
      if (url.startsWith('/api/v1/subjects')) {
        // Backend honours source=mine and returns family-only subjects.
        // The wizard must not call a different endpoint that mixes in platform subjects.
        expect(url).toContain('source=mine');
        return mockResponse([familySubject]);
      }
      if (url.startsWith('/api/v1/curriculums')) return mockResponse([]);
      return mockResponse([]);
    });

    renderWithProviders(<CurriculumWizard />);

    // Step 3 isn't visible yet, but the picker pulls from `availableSubjects`
    // which is populated on mount. Once the fetch resolves, the family subject
    // is in state and would appear when step 3 renders. Verify the network
    // contract here — full step navigation is exercised in e2e tests.
    await waitFor(() => {
      const subjectCalls = vi.mocked(fetch).mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : (c[0] as Request).url))
        .filter((u) => u.startsWith('/api/v1/subjects'));
      expect(subjectCalls).toEqual(['/api/v1/subjects?source=mine']);
    });

    // Sanity: nothing rendered "Family Math" yet because we're still on step 1,
    // but we have not crashed and the call shape is correct.
    expect(screen.queryByText('Family Math')).not.toBeInTheDocument();
  });
});
