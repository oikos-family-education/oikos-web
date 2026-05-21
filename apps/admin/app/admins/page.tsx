'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface Entry {
  id: string;
  email: string;
  added_by_admin_email: string | null;
  added_at: string;
  source: 'env' | 'db';
}

export default function AdminsPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch('/api/v1/admin/allowlist')
      .then(async (r) => (r.ok ? r.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/admin/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.detail === 'string' ? j.detail : 'Could not add admin');
        return;
      }
      setNewEmail('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = async (email: string) => {
    if (!confirm(`Remove ${email} from the admin allowlist?`)) return;
    const res = await apiFetch(`/api/v1/admin/allowlist/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(typeof j.detail === 'string' ? j.detail : 'Could not remove admin');
      return;
    }
    load();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admins</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage the admin allowlist.</p>
      </div>

      <form onSubmit={addAdmin} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Add admin</h2>
        <p className="text-xs text-slate-500">
          The email must belong to an existing Oikos user. They&apos;ll be able to log in immediately.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={busy}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={busy || !newEmail.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                <th className="px-4 py-2.5 text-left font-semibold">Source</th>
                <th className="px-4 py-2.5 text-left font-semibold">Added by</th>
                <th className="px-4 py-2.5 text-left font-semibold">Added at</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={`${a.source}-${a.email}`} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        a.source === 'env' ? 'bg-slate-100 text-slate-600' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {a.source === 'env' ? 'env-var' : 'UI-added'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{a.added_by_admin_email || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {a.source === 'env' ? '—' : new Date(a.added_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {a.source === 'env' ? (
                      <span className="text-xs text-slate-400" title="Remove from OIKOS_ADMIN_EMAILS and redeploy">
                        env-managed
                      </span>
                    ) : (
                      <button
                        onClick={() => removeAdmin(a.email)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
