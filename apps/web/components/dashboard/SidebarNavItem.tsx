'use client';

import React from 'react';
import { Link, usePathname } from '../../lib/navigation';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  /** Show a small "Soon" pill next to the label. */
  soon?: boolean;
  /** Show a red badge (count) next to the label / icon. Hidden when 0/undefined. */
  badge?: number;
}

export function SidebarNavItem({ href, label, icon: Icon, collapsed, soon, badge }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');
  const showBadge = !!badge && badge > 0;

  return (
    <Link
      href={href}
      title={collapsed ? `${label}${soon ? ' (Soon)' : ''}${showBadge ? ` · ${badge}` : ''}` : undefined}
      aria-label={soon ? `${label} (coming soon)` : label}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold border-l-[3px] border-primary -ml-[3px]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <span className="relative">
        <Icon className="h-5 w-5 flex-shrink-0" />
        {collapsed && showBadge && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] leading-none rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="flex-1 flex items-center gap-2 min-w-0">
          <span className="truncate">{label}</span>
          {showBadge && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
          {soon && !showBadge && (
            <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              Soon
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
