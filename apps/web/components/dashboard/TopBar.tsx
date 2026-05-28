'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { NotificationBell } from '../community/NotificationBell';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 lg:invisible"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <NotificationBell />
    </header>
  );
}
