import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { PrivacyTab } from '../../components/family/tabs/PrivacyTab';
import { buildDefaultFormData, FamilyApiResponse } from '../../components/family/familyFormTypes';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('PrivacyTab export', () => {
  const family = { id: 'f1', family_name: 'Silva', visibility: 'local' } as unknown as FamilyApiResponse;
  const formData = { ...buildDefaultFormData(), family_name: 'Silva' };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no export button and points to Settings instead', () => {
    renderWithProviders(<PrivacyTab family={family} formData={formData} onFamilyUpdated={() => {}} />);

    expect(screen.queryByRole('button', { name: /request export/i })).toBeNull();
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link).toHaveAttribute('href', '/settings');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
