'use client';

import React, { useState, useEffect } from 'react';
import {
  Home, Users, Star, BookOpen, LayoutGrid, Calendar, Layers,
  Library, StickyNote, BarChart3, Sparkles, Globe, Settings,
  ChevronsLeft, ChevronsRight, GraduationCap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavGroup } from './SidebarNavGroup';
import { FamilyIdentity } from './FamilyIdentity';

const STORAGE_KEY = 'oikos-sidebar-collapsed';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations('Navigation');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-xl font-bold text-slate-800 tracking-tight">Oikos</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {/* Top — quick daily access */}
        <div className="space-y-0.5">
          <SidebarNavItem href="/dashboard" label={t('dashboard')} icon={Home} collapsed={collapsed} />
          <SidebarNavItem href="/notes" label={t('notes')} icon={StickyNote} collapsed={collapsed} />
          <SidebarNavItem href="/progress" label={t('progress')} icon={BarChart3} collapsed={collapsed} />
        </div>

        {/* Educate group */}
        <SidebarNavGroup label={t('groupEducate')} collapsed={collapsed}>
          <SidebarNavItem href="/subjects" label={t('subjects')} icon={BookOpen} collapsed={collapsed} />
          <SidebarNavItem href="/curriculums" label={t('curriculums')} icon={GraduationCap} collapsed={collapsed} />
          <SidebarNavItem href="/planner" label={t('planner')} icon={LayoutGrid} collapsed={collapsed} />
          <SidebarNavItem href="/calendar" label={t('calendar')} icon={Calendar} collapsed={collapsed} />
          <SidebarNavItem href="/projects" label={t('projects')} icon={Layers} collapsed={collapsed} />
          <SidebarNavItem href="/resources" label={t('resources')} icon={Library} collapsed={collapsed} />
        </SidebarNavGroup>

        {/* Family group */}
        <SidebarNavGroup label={t('groupFamily')} collapsed={collapsed}>
          <SidebarNavItem href="/children" label={t('children')} icon={Star} collapsed={collapsed} />
          <SidebarNavItem href="/family" label={t('family')} icon={Users} collapsed={collapsed} />
        </SidebarNavGroup>

        {/* Support group */}
        <SidebarNavGroup label={t('groupSupport')} collapsed={collapsed}>
          <SidebarNavItem href="/community" label={t('community')} icon={Globe} collapsed={collapsed} soon />
          <SidebarNavItem href="/assistant" label={t('assistant')} icon={Sparkles} collapsed={collapsed} soon />
        </SidebarNavGroup>

        {/* Settings - ungrouped */}
        <div className="pt-2 border-t border-slate-200">
          <SidebarNavItem href="/settings" label={t('settings')} icon={Settings} collapsed={collapsed} />
        </div>
      </nav>

      {/* Family identity */}
      <div className="border-t border-slate-200 px-3 py-3">
        <FamilyIdentity collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-slate-100 px-3 py-2">
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-2 px-2 py-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors w-full"
          title={collapsed ? t('expand') : t('collapse')}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 mx-auto" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span className="text-xs">{t('collapse')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={onMobileClose} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl z-50">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
