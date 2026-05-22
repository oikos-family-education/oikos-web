'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { ModerationActionDialog } from '../../components/ModerationActionDialog';

interface BlockedItem {
  user_id: string;
  email: string;
  reason: string | null;
  set_by: string | null;
  set_at: string | null;
  expires_at: string | null;
}

interface BannedItem {
  user_id: string;
  email: string;
  reason: string | null;
  set_by: string | null;
  set_at: string | null;
}

interface BlacklistItem {
  email: string;
  source_action: string | null;
  source_actor_email: string | null;
  created_at: string;
}

interface Data {
  blocked: BlockedItem[];
  banned: BannedItem[];
  blacklist: BlacklistItem[];
}

export default function ModerationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [unblockTarget, setUnblockTarget] = useState<BlockedItem | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch('/api/v1/admin/moderation')
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  if (!data) return <div className="text-slate-500 text-sm">Could not load moderation data.</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Moderation</h1>
        <p className="text-slate-500 mt-1 text-sm">Active blocks, bans, and the email blacklist.</p>
      </div>

      <Section title={`Active blocks (${data.blocked.length})`}>
        {data.blocked.length === 0 ? (
          <Empty>No active blocks.</Empty>
        ) : (
          <Table
            head={['Email', 'Reason', 'Set by', 'Set at', 'Expires', '']}
            rows={data.blocked.map((b) => [
              b.email,
              b.reason || '—',
              b.set_by || '—',
              b.set_at ? new Date(b.set_at).toLocaleString() : '—',
              b.expires_at ? new Date(b.expires_at).toLocaleString() : 'indefinite',
              <button
                key="unblock"
                onClick={() => setUnblockTarget(b)}
                className="px-3 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Unblock
              </button>,
            ])}
          />
        )}
      </Section>

      <Section title={`Active bans (${data.banned.length})`}>
        {data.banned.length === 0 ? (
          <Empty>No active bans.</Empty>
        ) : (
          <Table
            head={['Email', 'Reason', 'Set by', 'Set at']}
            rows={data.banned.map((b) => [
              b.email,
              b.reason || '—',
              b.set_by || '—',
              b.set_at ? new Date(b.set_at).toLocaleString() : '—',
            ])}
          />
        )}
      </Section>

      <Section title={`Email blacklist (${data.blacklist.length})`}>
        {data.blacklist.length === 0 ? (
          <Empty>No blacklisted emails.</Empty>
        ) : (
          <Table
            head={['Email', 'Source', 'Source actor', 'Added']}
            rows={data.blacklist.map((b) => [
              b.email,
              b.source_action || '—',
              b.source_actor_email || '—',
              new Date(b.created_at).toLocaleString(),
            ])}
          />
        )}
      </Section>

      {unblockTarget && (
        <ModerationActionDialog
          type="unblock"
          user={{ user_id: unblockTarget.user_id, email: unblockTarget.email }}
          onClose={() => setUnblockTarget(null)}
          onSuccess={() => {
            setUnblockTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-sm text-slate-500">{children}</p>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-2.5 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-100">
            {r.map((c, j) => (
              <td key={j} className="px-4 py-2.5 text-slate-700">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
