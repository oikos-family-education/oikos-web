'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface Entry {
  id: string;
  ts: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_email: string | null;
  reason: string | null;
  snapshot: Record<string, unknown> | null;
}

const ACTION_OPTIONS = [
  'admin.login',
  'admin.login_denied',
  'admin.add',
  'admin.remove',
  'beta.approve',
  'beta.approve_over_cap',
  'beta.deny',
  'beta.reopen',
  'beta.resend_invite',
  'user.block',
  'user.unblock',
  'user.ban',
  'user.remove',
];

export default function AuditLogPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterActor) params.set('actor_email', filterActor);
    if (filterTarget) params.set('target', filterTarget);
    filterActions.forEach((a) => params.append('action', a));
    apiFetch(`/api/v1/admin/audit-log?${params.toString()}`)
      .then(async (r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [filterActor, filterTarget, filterActions]);

  const toggleAction = (a: string) => {
    setFilterActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit log</h1>
        <p className="text-slate-500 mt-1 text-sm">Every admin action ever taken, newest first.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            placeholder="Filter by actor email…"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            placeholder="Filter by target email…"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => toggleAction(a)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterActions.includes(a)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center py-10 text-sm text-slate-500">No entries match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <button
                  className="flex items-start gap-2 w-full text-left"
                  onClick={() => setExpanded((cur) => (cur === e.id ? null : e.id))}
                >
                  {expanded === e.id ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 grid grid-cols-12 gap-3 items-baseline">
                    <span className="col-span-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.ts).toLocaleString()}
                    </span>
                    <span className="col-span-3 font-medium text-slate-800 truncate">{e.actor_email}</span>
                    <span className="col-span-3 inline-block">
                      <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs">
                        {e.action}
                      </code>
                    </span>
                    <span className="col-span-3 text-slate-600 truncate">{e.target_email || '—'}</span>
                  </div>
                </button>
                {expanded === e.id && (
                  <div className="mt-3 ml-6 space-y-2 text-xs text-slate-600">
                    {e.reason && (
                      <p>
                        <span className="font-semibold text-slate-700">Reason: </span>
                        {e.reason}
                      </p>
                    )}
                    {e.snapshot && (
                      <pre className="bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto">
                        {JSON.stringify(e.snapshot, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
