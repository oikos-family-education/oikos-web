'use client';

import React from 'react';
import { Menu } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 lg:hidden">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
