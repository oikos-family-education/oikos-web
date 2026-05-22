'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

interface Detail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  internal_note: string | null;
  applied_at: string;
  decided_at: string | null;
  decided_by_admin_email: string | null;
  invite_sent_at: string | null;
  invite_token_expires_at: string | null;
  invite_consumed_at: string | null;
  registered_user_id: string | null;
}

interface Props {
  appId: string;
  approvedCount: number;
  cap: number;
  onClose: () => void;
  onChanged: () => void;
}

export function BetaApplicationDetailPanel({ appId, approvedCount, cap, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirmOverCap, setConfirmOverCap] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch(`/api/v1/admin/beta/applications/${appId}`);
    if (!res.ok) {
      setError('Could not load application');
      setLoading(false);
      return;
    }
    const json = (await res.json()) as Detail;
    setDetail(json);
    setNote(json.internal_note || '');
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const act = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/admin/beta/applications/${appId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.detail?.code === 'over_cap_confirmation_required') {
          setConfirmOverCap(true);
          setError('Approving would exceed the beta cap. Click Approve again to confirm.');
          return;
        }
        setError(typeof j.detail === 'string' ? j.detail : j.detail?.detail || 'Action failed');
        return;
      }
      onChanged();
      await load();
      setConfirmOverCap(false);
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/admin/beta/applications/${appId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Application detail</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Field label="Name" value={`${detail.first_name} ${detail.last_name}`} />
            <Field label="Email" value={detail.email} />
            <Field label="Applied" value={new Date(detail.applied_at).toLocaleString()} />
            <Field label="Status" value={detail.status} />
            {detail.decided_at && (
              <Field
                label="Decided"
                value={`${new Date(detail.decided_at).toLocaleString()} by ${detail.decided_by_admin_email}`}
              />
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Reason</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.reason}</p>
            </div>

            {detail.status === 'approved' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-sm">
                <p className="font-semibold text-slate-700">Invite status</p>
                {detail.invite_consumed_at ? (
                  <p className="text-emerald-700">
                    Registered at {new Date(detail.invite_consumed_at).toLocaleString()}
                  </p>
                ) : detail.invite_token_expires_at &&
                  new Date(detail.invite_token_expires_at) < new Date() ? (
                  <p className="text-red-700">
                    Expired at {new Date(detail.invite_token_expires_at).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-slate-700">Pending registration</p>
                )}
                {detail.invite_sent_at && (
                  <p className="text-slate-500 text-xs">
                    Last invite sent: {new Date(detail.invite_sent_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Internal note
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Visible only to admins. Saved on blur."
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
              {detail.status === 'pending' && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act('approve', { over_cap_confirmed: confirmOverCap || approvedCount >= cap })
                    }
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {confirmOverCap ? 'Confirm approve (over cap)' : 'Approve'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act('deny')}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </>
              )}
              {detail.status === 'denied' && (
                <button
                  disabled={busy}
                  onClick={() => act('reopen')}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Re-open
                </button>
              )}
              {detail.status === 'approved' && !detail.invite_consumed_at && (
                <button
                  disabled={busy}
                  onClick={() => act('resend-invite')}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Resend invite
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}
