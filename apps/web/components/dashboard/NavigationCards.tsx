'use client';

import React from 'react';
import { Link } from '../../lib/navigation';
import {
  BookOpen, LayoutGrid, Calendar, Layers,
  Library, StickyNote, BarChart3, Sparkles, Globe, GraduationCap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';

interface CardDef {
  key: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

const CARDS: CardDef[] = [
  { key: 'subjects', href: '/subjects', icon: BookOpen, color: 'bg-indigo-100 text-indigo-600' },
  { key: 'curriculums', href: '/curriculums', icon: GraduationCap, color: 'bg-violet-100 text-violet-600' },
  { key: 'planner', href: '/planner', icon: LayoutGrid, color: 'bg-blue-100 text-blue-600' },
  { key: 'calendar', href: '/calendar', icon: Calendar, color: 'bg-cyan-100 text-cyan-600' },
  { key: 'projects', href: '/projects', icon: Layers, color: 'bg-violet-100 text-violet-600' },
  { key: 'resources', href: '/resources', icon: Library, color: 'bg-amber-100 text-amber-700' },
  { key: 'notes', href: '/notes', icon: StickyNote, color: 'bg-emerald-100 text-emerald-600' },
  { key: 'progress', href: '/progress', icon: BarChart3, color: 'bg-rose-100 text-rose-600' },
  { key: 'assistant', href: '/assistant', icon: Sparkles, color: 'bg-purple-100 text-purple-600' },
  { key: 'community', href: '/community', icon: Globe, color: 'bg-teal-100 text-teal-600' },
];

export function NavigationCards() {
  const tNav = useTranslations('Navigation');
  const tCards = useTranslations('Cards');

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-700 mb-4">
        {useTranslations('Dashboard')('quickAccess')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CARDS.map(({ key, href, icon: Icon, color }) => (
          <Link
            key={key}
            href={href}
            className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className={`p-2.5 rounded-lg ${color} flex-shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800 group-hover:text-primary transition-colors">
                {tNav(key)}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">{tCards(key)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
