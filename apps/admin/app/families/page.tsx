'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface Item {
  family_id: string;
  family_name: string;
  owner_email: string | null;
  owner_user_id: string | null;
  member_count: number;
  child_count: number;
  created_at: string;
  last_active_at: string | null;
  owner_status: 'active' | 'blocked' | 'banned';
}

export default function FamiliesListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    apiFetch(`/api/v1/admin/families?${params.toString()}`)
      .then(async (r) => (r.ok ? r.json() : { items: [], total: 0 }))
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Families</h1>
          <p className="text-slate-500 mt-1 text-sm">{total} families total.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or owner email…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-sm text-slate-500">No families match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Family</th>
                <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
                <th className="px-4 py-2.5 text-left font-semibold">Members</th>
                <th className="px-4 py-2.5 text-left font-semibold">Children</th>
                <th className="px-4 py-2.5 text-left font-semibold">Created</th>
                <th className="px-4 py-2.5 text-left font-semibold">Last active</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.family_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/families/${f.family_id}`} className="text-slate-800 hover:text-primary">
                      {f.family_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{f.owner_email || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.member_count}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.child_count}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {f.last_active_at ? new Date(f.last_active_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={f.owner_status} />
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

function StatusPill({ status }: { status: 'active' | 'blocked' | 'banned' }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    blocked: 'bg-amber-100 text-amber-800',
    banned: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
