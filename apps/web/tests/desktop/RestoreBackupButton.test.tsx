import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import en from '../../messages/en.json';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('../../lib/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { RestoreBackupButton } from '../../components/desktop/RestoreBackupButton';
import Home from '../../app/[locale]/page';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function pickFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['PK'], 'family.oikos', { type: 'application/zip' });
  fireEvent.change(input, { target: { files: [file] } });
  return { input, file };
}

describe('RestoreBackupButton', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('accepts only .oikos files through a hidden input', () => {
    const { container } = renderWithProviders(<RestoreBackupButton />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.oikos');
    expect(input).toHaveClass('hidden');
  });

  it('asks for confirmation before uploading', async () => {
    fetchMock.mockResolvedValue(json(200, { emails: ['ana@example.com'] }));
    const { container } = renderWithProviders(<RestoreBackupButton />);
    const { file } = pickFile(container);

    expect(await screen.findByText(en.Desktop.restoreConfirmTitle)).toBeInTheDocument();
    expect(screen.getByText(en.Desktop.restoreConfirmBody)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: en.Desktop.restoreConfirmButton }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/desktop/restore');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(((init.body as FormData).get('file') as File).name).toBe(file.name);
  });

  it('does not upload when the confirmation is cancelled', async () => {
    const { container } = renderWithProviders(<RestoreBackupButton />);
    pickFile(container);
    await screen.findByText(en.Desktop.restoreConfirmTitle);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(en.Desktop.restoreConfirmTitle)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const failures: Array<[string, () => Response, string]> = [
    ['not_a_backup', () => json(400, { detail: { detail: 'x', code: 'not_a_backup' } }), en.Desktop.restoreNotABackup],
    ['backup_too_new', () => json(400, { detail: { detail: 'x', code: 'backup_too_new' } }), en.Desktop.restoreTooNew],
    ['restore_failed (500)', () => json(500, { detail: { code: 'restore_failed' } }), en.Desktop.restoreFailed],
    ['bad_origin (403)', () => json(403, { detail: { code: 'bad_origin' } }), en.Desktop.restoreFailed],
    ['rate limited (429)', () => json(429, {}), en.Desktop.restoreFailed],
    ['unknown 400 code', () => json(400, { detail: { code: 'other' } }), en.Desktop.restoreFailed],
  ];
  for (const [name, makeResponse, message] of failures) {
    it(`maps ${name} to its message`, async () => {
      fetchMock.mockResolvedValue(makeResponse());
      const { container } = renderWithProviders(<RestoreBackupButton />);
      pickFile(container);
      fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByText(en.Desktop.restoreConfirmTitle)).toBeNull();
      expect(screen.getByRole('button', { name: en.Desktop.restoreButton })).toBeInTheDocument();
    });
  }

  it('shows restoreFailed when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { container } = renderWithProviders(<RestoreBackupButton />);
    pickFile(container);
    fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));
    expect(await screen.findByText(en.Desktop.restoreFailed)).toBeInTheDocument();
  });

  it('can retry after an error', async () => {
    fetchMock.mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, { emails: ['a@b.co'] }));
    const { container } = renderWithProviders(<RestoreBackupButton />);
    pickFile(container);
    fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));
    await screen.findByText(en.Desktop.restoreFailed);

    pickFile(container);
    fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));
    expect(await screen.findByRole('heading', { name: en.Desktop.restoreDoneTitle })).toBeInTheDocument();
  });

  it('shows the set-password form prefilled with the first email after a restore', async () => {
    fetchMock.mockResolvedValue(json(200, { emails: ['ana@example.com', 'bob@example.com'] }));
    const { container } = renderWithProviders(<RestoreBackupButton />);
    pickFile(container);
    fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));

    expect(await screen.findByRole('heading', { name: en.Desktop.restoreDoneTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('ana@example.com');
    expect(screen.queryByRole('button', { name: en.Desktop.restoreButton })).toBeNull();
  });

  it('shows the set-password form with an empty email when the backup lists none', async () => {
    fetchMock.mockResolvedValue(json(200, { emails: [] }));
    const { container } = renderWithProviders(<RestoreBackupButton />);
    pickFile(container);
    fireEvent.click(await screen.findByRole('button', { name: en.Desktop.restoreConfirmButton }));

    expect(await screen.findByRole('heading', { name: en.Desktop.restoreDoneTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
  });
});

describe('welcome page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('has no restore button in cloud mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    renderWithProviders(<Home />);
    expect(screen.queryByText(en.Desktop.restoreButton)).toBeNull();
  });

  it('shows the restore button in desktop mode', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    renderWithProviders(<Home />);
    expect(screen.getAllByText(en.Desktop.restoreButton).length).toBeGreaterThan(0);
  });
});
