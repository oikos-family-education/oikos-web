'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface OverviewData {
  counts: Record<string, { label: string; total: number; delta_7d: number }>;
  beta: { pending: number; approved: number; denied: number; total: number; cap: number };
  trend: { date: string; signups: number; beta_applications: number; beta_approvals: number }[];
  most_active_families: {
    family_id: string;
    family_name: string;
    owner_email: string | null;
    member_count: number;
    child_count: number;
    last_active_at: string | null;
  }[];
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/v1/admin/overview')
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  if (!data) return <div className="text-slate-500 text-sm">Could not load overview.</div>;

  const peakSignups = Math.max(1, ...data.trend.map((d) => d.signups));
  const peakApps = Math.max(1, ...data.trend.map((d) => d.beta_applications));
  const peakApprovals = Math.max(1, ...data.trend.map((d) => d.beta_approvals));

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
        <p className="text-slate-500 mt-1 text-sm">Current state of the platform.</p>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(data.counts).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{v.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{v.total.toLocaleString()}</p>
            {v.delta_7d > 0 ? (
              <p className="text-xs text-emerald-600 mt-0.5">+{v.delta_7d} this week</p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">No change this week</p>
            )}
          </div>
        ))}
      </div>

      {/* Beta */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Beta program</h2>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <BetaCount label="Pending" value={data.beta.pending} />
          <BetaCount label="Approved" value={data.beta.approved} />
          <BetaCount label="Denied" value={data.beta.denied} />
          <BetaCount label="Total" value={data.beta.total} />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Approved <span className="font-semibold text-slate-800">{data.beta.approved}</span> / {data.beta.cap}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (data.beta.approved / data.beta.cap) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Last 30 days</h2>
        <div className="grid grid-cols-30 gap-1 items-end" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
          {data.trend.map((d) => (
            <div key={d.date} className="flex flex-col items-center group relative" title={`${d.date}: ${d.signups} signups, ${d.beta_applications} apps, ${d.beta_approvals} approvals`}>
              <div className="w-full flex flex-col items-stretch gap-0.5 justify-end h-32">
                <div
                  className="bg-primary/70 rounded-sm"
                  style={{ height: `${(d.signups / peakSignups) * 100}%`, minHeight: d.signups > 0 ? '4px' : '0' }}
                />
                <div
                  className="bg-rose-400/70 rounded-sm"
                  style={{ height: `${(d.beta_applications / peakApps) * 60}%`, minHeight: d.beta_applications > 0 ? '4px' : '0' }}
                />
                <div
                  className="bg-emerald-500/70 rounded-sm"
                  style={{ height: `${(d.beta_approvals / peakApprovals) * 50}%`, minHeight: d.beta_approvals > 0 ? '4px' : '0' }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary/70 rounded-sm" />signups</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-400/70 rounded-sm" />applications</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500/70 rounded-sm" />approvals</span>
        </div>
      </div>

      {/* Most active */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Most active families</h2>
        </div>
        {data.most_active_families.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No families yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Family</th>
                <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
                <th className="px-4 py-2.5 text-left font-semibold">Members</th>
                <th className="px-4 py-2.5 text-left font-semibold">Children</th>
                <th className="px-4 py-2.5 text-left font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {data.most_active_families.map((f) => (
                <tr key={f.family_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <a href={`/families/${f.family_id}`} className="hover:text-primary">
                      {f.family_name}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{f.owner_email || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.member_count}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.child_count}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {f.last_active_at ? new Date(f.last_active_at).toLocaleString() : '—'}
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

function BetaCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}
