'use client';

import React, { useState } from 'react';
import { Loader2, X, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

interface Props {
  type: 'block' | 'unblock' | 'ban' | 'remove';
  user: { user_id: string; email: string };
  familyName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const COPY = {
  block: {
    title: 'Block account',
    body: 'The user will be signed out and can no longer log in. They can be unblocked at any time.',
    confirmLabel: 'Block account',
    variant: 'warning' as const,
    requiresReason: true,
    requiresEmailConfirm: false,
    requiresFamilyConfirm: false,
  },
  unblock: {
    title: 'Unblock account',
    body: 'The user will be able to log in again.',
    confirmLabel: 'Unblock account',
    variant: 'default' as const,
    requiresReason: false,
    requiresEmailConfirm: false,
    requiresFamilyConfirm: false,
  },
  ban: {
    title: 'Ban account (permanent)',
    body:
      'The user will be permanently banned. Their email will be added to the blacklist. This cannot be reversed from the UI.',
    confirmLabel: 'Permanently ban',
    variant: 'danger' as const,
    requiresReason: true,
    requiresEmailConfirm: true,
    requiresFamilyConfirm: false,
  },
  remove: {
    title: 'Remove account (hard delete)',
    body:
      'This permanently deletes the user. If they own a family, the family and all dependent content (children, lessons, projects, notes, etc.) will be deleted via CASCADE. This cannot be undone.',
    confirmLabel: 'Permanently remove',
    variant: 'danger' as const,
    requiresReason: true,
    requiresEmailConfirm: true,
    requiresFamilyConfirm: true,
  },
};

export function ModerationActionDialog({ type, user, familyName, onClose, onSuccess }: Props) {
  const config = COPY[type];
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [familyConfirm, setFamilyConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    (!config.requiresReason || reason.trim().length > 0) &&
    (!config.requiresEmailConfirm || emailConfirm.trim() === user.email) &&
    (!config.requiresFamilyConfirm || !familyName || familyConfirm.trim() === familyName);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { reason: reason || 'no reason given' };
      if (type === 'block' && expiresAt) body.expires_at = new Date(expiresAt).toISOString();
      const res = await apiFetch(`/api/v1/admin/users/${user.user_id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.detail === 'string' ? j.detail : j.detail?.detail || 'Action failed');
        return;
      }
      onSuccess();
    } finally {
      setBusy(false);
    }
  };

  const confirmStyle =
    config.variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : config.variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700'
        : 'bg-primary hover:bg-primary-hover';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className={`w-5 h-5 mt-0.5 ${
                config.variant === 'danger'
                  ? 'text-red-600'
                  : config.variant === 'warning'
                    ? 'text-amber-600'
                    : 'text-primary'
              }`}
            />
            <h2 className="font-semibold text-slate-800">{config.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 text-sm">
          <p className="text-slate-600">{config.body}</p>
          <p className="text-slate-800">
            Target: <strong>{user.email}</strong>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {config.requiresReason && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {type === 'block' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Expires at (optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-slate-500 mt-1">Leave blank for an indefinite block.</p>
            </div>
          )}

          {config.requiresEmailConfirm && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Type the user&apos;s email to confirm
              </label>
              <input
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                placeholder={user.email}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>
          )}

          {config.requiresFamilyConfirm && familyName && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Type the family name to confirm
              </label>
              <input
                value={familyConfirm}
                onChange={(e) => setFamilyConfirm(e.target.value)}
                placeholder={familyName}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${confirmStyle}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
