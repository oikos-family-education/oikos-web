'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  ScrollText,
  UserCog,
  Mail,
  LogOut,
} from 'lucide-react';
import { useAdminAuth } from '../providers/AdminAuthProvider';

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, enabled: false },
  { href: '/beta', label: 'Beta applications', icon: Mail, enabled: true },
  { href: '/families', label: 'Families', icon: Users, enabled: false },
  { href: '/moderation', label: 'Moderation', icon: ShieldAlert, enabled: false },
  { href: '/audit-log', label: 'Audit log', icon: ScrollText, enabled: false },
  { href: '/admins', label: 'Admins', icon: UserCog, enabled: false },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <h1 className="font-bold text-slate-800 text-lg">Oikos Admin</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 cursor-not-allowed"
                  title="Coming in the admin center spec"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-300">soon</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-200">
          <div className="px-3 py-2">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-medium text-slate-800 truncate">{admin?.email || '—'}</p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
