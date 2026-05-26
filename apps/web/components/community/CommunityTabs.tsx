'use client';

import React from 'react';
import { Link } from '../../lib/navigation';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  slug: string;
  canSettings: boolean;
}

export function CommunityTabs({ slug, canSettings }: Props) {
  const t = useTranslations('Community.tabs');
  const pathname = usePathname() ?? '';
  const tabs: { key: string; label: string; href: string }[] = [
    { key: 'overview', label: t('overview'), href: `/community/${slug}` },
    { key: 'members', label: t('members'), href: `/community/${slug}/members` },
    { key: 'forum', label: t('forum'), href: `/community/${slug}/forum` },
  ];
  if (canSettings) {
    tabs.push({ key: 'settings', label: t('settings'), href: `/community/${slug}/settings` });
  }

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname.endsWith(tab.href) || pathname.endsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                active
                  ? 'text-primary border-primary'
                  : 'text-slate-600 border-transparent hover:text-slate-800'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
