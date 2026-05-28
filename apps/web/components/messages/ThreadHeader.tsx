'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreVertical, ShieldOff, Flag, Trash2, BellOff, Bell } from 'lucide-react';
import { Link } from '../../lib/navigation';
import type { OtherFamilyIdentity } from './types';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface Props {
  other: OtherFamilyIdentity;
  notificationsMuted: boolean;
  onToggleMute: () => void;
  onBlock: () => void;
  onReport: () => void;
  onDelete: () => void;
}

export function ThreadHeader({
  other,
  notificationsMuted,
  onToggleMute,
  onBlock,
  onReport,
  onDelete,
}: Props) {
  const t = useTranslations('Messages');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const hasShield =
    other.shield_config &&
    (other.shield_config as unknown as Partial<ShieldConfig>).initials;

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {hasShield ? (
          <ShieldPreview
            config={other.shield_config as unknown as ShieldConfig}
            familyName={other.family_name}
            showFamilyName={false}
            width={32}
            height={40}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold inline-flex items-center justify-center">
            {other.family_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {other.family_name_slug ? (
            <Link
              href={`/discover/${other.family_name_slug}`}
              className="text-sm font-semibold text-slate-800 hover:text-primary truncate"
            >
              {other.family_name}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-slate-800 truncate">
              {other.family_name}
            </span>
          )}
        </div>
      </div>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="More"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggleMute();
              }}
              className="w-full text-left text-sm px-3 py-2 hover:bg-slate-50 inline-flex items-center gap-2"
            >
              {notificationsMuted ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
              {notificationsMuted ? t('unmuteButton') : t('muteButton')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onBlock();
              }}
              className="w-full text-left text-sm px-3 py-2 hover:bg-slate-50 inline-flex items-center gap-2"
            >
              <ShieldOff className="w-4 h-4" />
              {t('blockButton')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
              className="w-full text-left text-sm px-3 py-2 hover:bg-slate-50 inline-flex items-center gap-2"
            >
              <Flag className="w-4 h-4" />
              {t('reportButton')}
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('deleteThreadButton')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
