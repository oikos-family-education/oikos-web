'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronUp, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface FamilyIdentityProps {
  collapsed: boolean;
}

const DEFAULT_SHIELD: ShieldConfig = {
  initials: '',
  shape: 'heater',
  primary_color: '#9CA3AF',
  secondary_color: '#D1D5DB',
  accent_color: '#6B7280',
  symbol_color: '#FFFFFF',
  division: 'none',
  crest_animal: 'none',
  flourish: 'none',
  center_symbol: 'none',
  motto: '',
  font_style: 'serif',
};

export function FamilyIdentity({ collapsed }: FamilyIdentityProps) {
  const { family, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shieldConfig = family?.shield_config
    ? (family.shield_config as unknown as ShieldConfig)
    : DEFAULT_SHIELD;

  const familyName = family?.family_name || 'My Family';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 transition-colors ${
          collapsed ? 'justify-center' : ''
        }`}
        title={collapsed ? familyName : undefined}
        aria-label={`${familyName} menu`}
      >
        <div className="flex-shrink-0">
          <ShieldPreview
            config={shieldConfig}
            familyName={familyName}
            showMotto={false}
            width={32}
            height={36}
          />
        </div>
        {!collapsed && (
          <>
            <span className="text-sm font-medium text-slate-700 truncate flex-1 text-left">
              {familyName}
            </span>
            <ChevronUp
              className={`h-4 w-4 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute bottom-full mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 ${
            collapsed ? 'left-0 w-48' : 'left-0 right-0'
          }`}
        >
          <Link
            href="/family"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Users className="h-4 w-4" />
            Family Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
