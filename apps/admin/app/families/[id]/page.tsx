'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../lib/apiFetch';
import { ModerationActionDialog } from '../../../components/ModerationActionDialog';

interface Member {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  moderation_status: 'active' | 'blocked' | 'banned';
  last_login_at: string | null;
}

interface Detail {
  family_id: string;
  family_name: string;
  created_at: string;
  owner_email: string | null;
  owner_user_id: string | null;
  is_beta_approved: boolean;
  members: Member[];
  children: { child_id: string; first_name: string; created_at: string }[];
  content_counts: Record<string, number>;
  recent_activity: { type: string; id: string; title: string | null; ts: string | null }[];
}

export default function FamilyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{ type: 'block' | 'unblock' | 'ban' | 'remove'; user: Member } | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch(`/api/v1/admin/families/${id}`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  if (!detail) return <div className="text-slate-500 text-sm">Family not found.</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/families')} className="text-sm text-slate-500 hover:text-primary mb-2">
            ← All families
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{detail.family_name}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Created {new Date(detail.created_at).toLocaleDateString()}
            {detail.is_beta_approved && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                Beta-approved
              </span>
            )}
          </p>
        </div>
      </div>

      <Section title="Members">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Name</th>
              <th className="px-4 py-2.5 text-left font-semibold">Email</th>
              <th className="px-4 py-2.5 text-left font-semibold">Role</th>
              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {detail.members.map((m) => (
              <tr key={m.user_id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">
                  {m.first_name} {m.last_name}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{m.email}</td>
                <td className="px-4 py-2.5 text-slate-600">{m.role}</td>
                <td className="px-4 py-2.5">{m.moderation_status}</td>
                <td className="px-4 py-2.5 text-right space-x-2">
                  {m.moderation_status === 'active' && (
                    <>
                      <ActionButton onClick={() => setAction({ type: 'block', user: m })}>Block</ActionButton>
                      <ActionButton variant="warning" onClick={() => setAction({ type: 'ban', user: m })}>
                        Ban
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => setAction({ type: 'remove', user: m })}>
                        Remove
                      </ActionButton>
                    </>
                  )}
                  {m.moderation_status === 'blocked' && (
                    <ActionButton onClick={() => setAction({ type: 'unblock', user: m })}>Unblock</ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Children">
        {detail.children.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No children.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.children.map((c) => (
              <li key={c.child_id} className="px-4 py-2.5 text-sm flex justify-between">
                <span className="font-medium">{c.first_name}</span>
                <span className="text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Content">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 p-4">
          {Object.entries(detail.content_counts).map(([k, v]) => (
            <div key={k} className="text-center">
              <p className="text-2xl font-bold text-slate-800">{v}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent activity">
        {detail.recent_activity.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.recent_activity.map((a) => (
              <li key={`${a.type}-${a.id}`} className="px-4 py-2.5 text-sm flex justify-between">
                <span>
                  <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">{a.type}</span>
                  <span className="font-medium">{a.title || a.id}</span>
                </span>
                <span className="text-slate-500">{a.ts ? new Date(a.ts).toLocaleString() : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {action && (
        <ModerationActionDialog
          type={action.type}
          user={{ user_id: action.user.user_id, email: action.user.email }}
          familyName={detail.family_name}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            if (action.type === 'remove') router.push('/families');
            else load();
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

function ActionButton({
  children,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'warning' | 'danger';
}) {
  const styles =
    variant === 'danger'
      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md border text-xs font-semibold transition-colors ${styles}`}
    >
      {children}
    </button>
  );
}
