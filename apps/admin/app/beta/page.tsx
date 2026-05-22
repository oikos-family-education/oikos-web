'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { BetaApplicationDetailPanel } from '../../components/BetaApplicationDetailPanel';

type Status = 'pending' | 'approved' | 'denied' | 'all';

interface ListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reason: string;
  status: Exclude<Status, 'all'>;
  applied_at: string;
  decided_at: string | null;
}

interface ListResponse {
  items: ListItem[];
  total: number;
  approved_count: number;
  pending_count: number;
  denied_count: number;
  cap: number;
}

const TABS: { value: Status; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'all', label: 'All' },
];

export default function BetaApplicationsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    apiFetch(`/api/v1/admin/beta/applications?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          return;
        }
        const json = (await res.json()) as ListResponse;
        if (!cancelled) setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, search, refreshKey]);

  const formatted = useMemo(() => {
    if (!data) return [];
    return data.items.map((i) => ({
      ...i,
      applied_at_label: new Date(i.applied_at).toLocaleString(),
      reason_truncated: i.reason.length > 80 ? `${i.reason.slice(0, 80)}…` : i.reason,
    }));
  }, [data]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Beta applications</h1>
          <p className="text-slate-500 mt-1 text-sm">Review and decide on closed-beta applications.</p>
        </div>
        {data && (
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
            <div className="text-sm">
              <span className="font-semibold text-slate-800">{data.approved_count}</span>
              <span className="text-slate-500"> / {data.cap}</span>
              <span className="text-slate-500 text-xs ml-2">approved</span>
            </div>
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (data.approved_count / data.cap) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  status === tab.value
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                {tab.value !== 'all' && data && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({tab.value === 'pending'
                      ? data.pending_count
                      : tab.value === 'approved'
                        ? data.approved_count
                        : data.denied_count})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : formatted.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">No applications match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Applied</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {formatted.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.applied_at_label}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {row.first_name} {row.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.email}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-md">{row.reason_truncated}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <BetaApplicationDetailPanel
          appId={selectedId}
          approvedCount={data?.approved_count ?? 0}
          cap={data?.cap ?? 50}
          onClose={() => setSelectedId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'denied' }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    denied: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
