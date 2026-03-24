'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../providers/AuthProvider';

function getGreetingKey(): string {
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

export function WelcomeSection() {
  const t = useTranslations('Dashboard');
  const { family } = useAuth();

  // Avoid hydration mismatch by computing time-dependent values client-side only
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setGreeting(t(getGreetingKey()));
    setDateStr(formatDate());
  }, [t]);

  const familyName = family?.family_name || 'family';

  return (
    <div className="mb-8">
      <h1 className="text-3xl lg:text-4xl font-bold text-slate-800">
        {greeting ? `${greeting}, ${familyName}.` : '\u00A0'}
      </h1>
      {dateStr && (
        <p className="text-slate-500 mt-1">{dateStr}</p>
      )}
      <p className="text-slate-400 mt-4 text-sm max-w-xl">
        {t('encouragement')}
      </p>
    </div>
  );
}
