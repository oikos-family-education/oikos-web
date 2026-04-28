'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';
import { Shield, Plus, BookCheck, StickyNote, CalendarPlus } from 'lucide-react';
import { QuickProgressModal } from './QuickProgressModal';
import { QuickNoteModal } from './QuickNoteModal';
import { QuickEventModal } from './QuickEventModal';

const PLACEHOLDER_SHIELD: ShieldConfig = {
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

function getGreetingKey(): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'greeting_morning';
  if (hour >= 12 && hour < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}

function formatDate(): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function DashboardHero() {
  const t = useTranslations('Dashboard');
  const { user, family } = useAuth();

  // Compute time-dependent values client-side to avoid hydration mismatch.
  const [greeting, setGreeting] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [logOpen, setLogOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  useEffect(() => {
    setGreeting(t(getGreetingKey(), { name: user?.first_name || family?.family_name || '' }));
    setDateStr(formatDate());
  }, [t, user?.first_name, family?.family_name]);

  const hasShield = Boolean(user?.has_coat_of_arms && family?.shield_config);
  const shieldConfig = hasShield
    ? (family!.shield_config as unknown as ShieldConfig)
    : PLACEHOLDER_SHIELD;
  const familyName = family?.family_name || 'Your Family';

  return (
    <>
      <section
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 sm:p-8 shadow-sm"
        aria-labelledby="dashboard-hero-title"
      >
        {/* Decorative blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — identity + greeting */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="flex-shrink-0">
              {hasShield ? (
                <ShieldPreview
                  config={shieldConfig}
                  familyName={familyName}
                  showMotto={false}
                  width={56}
                  height={64}
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Shield className="h-7 w-7" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1
                id="dashboard-hero-title"
                className="text-xl sm:text-2xl font-bold text-slate-800 truncate"
              >
                {familyName}
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {greeting || ' '}
              </p>
              {dateStr && (
                <p className="text-xs text-slate-500 mt-1">{dateStr}</p>
              )}
              {!hasShield && (
                <Link
                  href="/family"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('setupShield')}
                </Link>
              )}
            </div>
          </div>

          {/* Right — quick actions */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-2">
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              <BookCheck className="h-4 w-4" />
              <span>{t('quickLogProgress')}</span>
            </button>

            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              <StickyNote className="h-4 w-4" />
              <span>{t('quickNewNote')}</span>
            </button>

            <button
              type="button"
              onClick={() => setEventOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>{t('quickAddEvent')}</span>
            </button>
          </div>
        </div>
      </section>

      <QuickProgressModal open={logOpen} onClose={() => setLogOpen(false)} />
      <QuickNoteModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        defaultStatus="todo"
      />
      <QuickEventModal open={eventOpen} onClose={() => setEventOpen(false)} />
    </>
  );
}
