import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ModerationActionDialog } from '../components/ModerationActionDialog';

const USER = { user_id: 'u-1', email: 'target@example.com' };

function mockFetchOk(body: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchFail(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function getReasonField(): HTMLTextAreaElement {
  const el = document.querySelector('textarea');
  if (!el) throw new Error('reason textarea not found');
  return el as HTMLTextAreaElement;
}

function getExpiresAtField(): HTMLInputElement {
  const el = document.querySelector('input[type="datetime-local"]');
  if (!el) throw new Error('expires_at input not found');
  return el as HTMLInputElement;
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetchOk());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ModerationActionDialog — block', () => {
  it('disables confirm until a reason is provided', () => {
    render(
      <ModerationActionDialog type="block" user={USER} onClose={() => {}} onSuccess={() => {}} />,
    );
    const confirm = screen.getByRole('button', { name: /^block account$/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(getReasonField(), { target: { value: 'spam' } });
    expect(confirm).not.toBeDisabled();
  });

  it('posts to the block endpoint with reason and expires_at when provided', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    const onSuccess = vi.fn();

    render(
      <ModerationActionDialog
        type="block"
        user={USER}
        onClose={() => {}}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(getReasonField(), { target: { value: 'violated terms' } });
    fireEvent.change(getExpiresAtField(), { target: { value: '2026-12-31T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^block account$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/admin/users/u-1/block');
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body as string);
    expect(sent.reason).toBe('violated terms');
    expect(typeof sent.expires_at).toBe('string');
    expect(new Date(sent.expires_at).toISOString()).toBe(sent.expires_at);
  });

  it('shows the API error detail and does not call onSuccess on failure', async () => {
    vi.stubGlobal('fetch', mockFetchFail(400, { detail: 'cannot act on self' }));
    const onSuccess = vi.fn();

    render(
      <ModerationActionDialog
        type="block"
        user={USER}
        onClose={() => {}}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(getReasonField(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^block account$/i }));

    expect(await screen.findByText('cannot act on self')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('ModerationActionDialog — unblock', () => {
  it('renders without a reason field and confirm is enabled immediately', () => {
    render(
      <ModerationActionDialog type="unblock" user={USER} onClose={() => {}} onSuccess={() => {}} />,
    );
    expect(document.querySelector('textarea')).toBeNull();
    expect(screen.getByRole('button', { name: /^unblock account$/i })).not.toBeDisabled();
  });

  it('hits the unblock endpoint', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    const onSuccess = vi.fn();

    render(
      <ModerationActionDialog
        type="unblock"
        user={USER}
        onClose={() => {}}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^unblock account$/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/users/u-1/unblock');
  });
});

describe('ModerationActionDialog — ban', () => {
  it('requires a reason AND a matching email confirmation', () => {
    render(
      <ModerationActionDialog type="ban" user={USER} onClose={() => {}} onSuccess={() => {}} />,
    );
    const confirm = screen.getByRole('button', { name: /permanently ban/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(getReasonField(), { target: { value: 'spam' } });
    expect(confirm).toBeDisabled();

    const emailInput = screen.getByPlaceholderText(USER.email);
    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: USER.email } });
    expect(confirm).not.toBeDisabled();
  });
});

describe('ModerationActionDialog — remove', () => {
  it('requires reason, email, AND family-name confirmation when family is given', () => {
    render(
      <ModerationActionDialog
        type="remove"
        user={USER}
        familyName="The Smiths"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    const confirm = screen.getByRole('button', { name: /permanently remove/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(getReasonField(), { target: { value: 'requested' } });
    fireEvent.change(screen.getByPlaceholderText(USER.email), {
      target: { value: USER.email },
    });
    expect(confirm).toBeDisabled();

    const familyInput = screen.getByPlaceholderText('The Smiths');
    fireEvent.change(familyInput, { target: { value: 'Wrong Family' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(familyInput, { target: { value: 'The Smiths' } });
    expect(confirm).not.toBeDisabled();
  });

  it('does not require family-name confirm when familyName is absent', () => {
    render(
      <ModerationActionDialog type="remove" user={USER} onClose={() => {}} onSuccess={() => {}} />,
    );
    fireEvent.change(getReasonField(), { target: { value: 'r' } });
    fireEvent.change(screen.getByPlaceholderText(USER.email), {
      target: { value: USER.email },
    });
    expect(screen.queryByPlaceholderText(/smiths/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /permanently remove/i })).not.toBeDisabled();
  });
});

describe('ModerationActionDialog — common behavior', () => {
  it('calls onClose when the X (close) button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ModerationActionDialog type="unblock" user={USER} onClose={onClose} onSuccess={() => {}} />,
    );
    const buttons = screen.getAllByRole('button');
    const xButton = buttons.find((b) => b.querySelector('svg'));
    expect(xButton).toBeTruthy();
    fireEvent.click(xButton!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit when validation fails (defensive double-click)', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ModerationActionDialog type="ban" user={USER} onClose={() => {}} onSuccess={() => {}} />,
    );
    const confirm = screen.getByRole('button', { name: /permanently ban/i });
    fireEvent.click(confirm);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
