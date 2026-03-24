'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
}

export function SidebarNavItem({ href, label, icon: Icon, collapsed }: SidebarNavItemProps) {
  const pathname = usePathname();
  // Strip locale prefix for comparison
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
  const isActive = pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/');

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold border-l-[3px] border-primary -ml-[3px]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
