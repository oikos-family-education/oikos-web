import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import en from '../../messages/en.json';
import { renderWithProviders } from '../utils/renderWithProviders';
import { BackupSection, REVOKE_DELAY_MS } from '../../components/settings/BackupSection';

const FILENAME = 'Oikos-backup-smith-2026-10-23.oikos';

function zipResponse() {
  return new Response(new Blob(['PK-fake-zip']), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${FILENAME}"`,
    },
  });
}

describe('BackupSection', () => {
  let clicked: HTMLAnchorElement[];
  let createObjectURL: ReturnType<typeof vi.fn<[Blob], string>>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    clicked = [];
    createObjectURL = vi.fn<[Blob], string>(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  for (const mode of ['', 'desktop']) {
    it(`renders and downloads with the server filename (${mode || 'cloud'} mode)`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.stubEnv('NEXT_PUBLIC_APP_MODE', mode);
      const fetchMock = vi.fn().mockResolvedValue(zipResponse());
      vi.stubGlobal('fetch', fetchMock);

      renderWithProviders(<BackupSection />);
      expect(screen.getByText(en.Settings.backupTitle)).toBeInTheDocument();
      expect(screen.getByText(en.Settings.backupSubtitle)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: en.Settings.backupButton }));

      await waitFor(() => expect(clicked).toHaveLength(1));
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/families/me/export',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(clicked[0].download).toBe(FILENAME);
      expect(clicked[0].href).toBe('blob:fake-url');
      // Revoked later, not right after the click (Safari would cancel the download)
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(REVOKE_DELAY_MS);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  }

  it('falls back to a default filename when the header is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['x']), { status: 200 })));
    renderWithProviders(<BackupSection />);
    fireEvent.click(screen.getByRole('button', { name: en.Settings.backupButton }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe('Oikos-backup.oikos');
  });

  it('shows backupError when the server answers with an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    renderWithProviders(<BackupSection />);
    fireEvent.click(screen.getByRole('button', { name: en.Settings.backupButton }));
    expect(await screen.findByText(en.Settings.backupError)).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
    expect(screen.getByRole('button', { name: en.Settings.backupButton })).toBeEnabled();
  });

  it('shows backupError when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderWithProviders(<BackupSection />);
    fireEvent.click(screen.getByRole('button', { name: en.Settings.backupButton }));
    expect(await screen.findByText(en.Settings.backupError)).toBeInTheDocument();
  });
});
