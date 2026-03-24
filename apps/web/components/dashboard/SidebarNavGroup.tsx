'use client';

import React from 'react';

interface SidebarNavGroupProps {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}

export function SidebarNavGroup({ label, collapsed, children }: SidebarNavGroupProps) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </p>
      )}
      {collapsed && <div className="border-t border-slate-200 mx-2 my-1" />}
      {children}
    </div>
  );
}
