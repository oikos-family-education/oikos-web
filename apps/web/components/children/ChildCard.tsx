'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Child {
  id: string;
  first_name: string;
  nickname?: string;
  birthdate?: string;
  birth_year?: number;
  grade_level?: string;
  child_curriculum: string[];
  learning_styles: string[];
}

interface ChildCardProps {
  child: Child;
  onClick: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

const GRADE_LABELS: Record<string, string> = {
  pre_k: 'Pre-K',
  k: 'Kindergarten',
  grade_1: 'Grade 1', grade_2: 'Grade 2', grade_3: 'Grade 3',
  grade_4: 'Grade 4', grade_5: 'Grade 5', grade_6: 'Grade 6',
  grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9',
  grade_10: 'Grade 10', grade_11: 'Grade 11', grade_12: 'Grade 12',
  stage_early: 'Early Stage',
  stage_middle: 'Middle Stage',
  stage_upper: 'Upper Stage',
  graduated: 'Graduated',
};

const LEARNING_STYLE_LABELS: Record<string, string> = {
  visual: 'Visual',
  auditory: 'Auditory',
  kinesthetic: 'Kinesthetic',
  reading_writing: 'Reading-Writing',
  social: 'Social',
};

function getInitials(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getInitialColor(name: string): string {
  const colors = [
    'from-violet-400 to-violet-600',
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-amber-400 to-amber-600',
    'from-rose-400 to-rose-600',
    'from-cyan-400 to-cyan-600',
    'from-fuchsia-400 to-fuchsia-600',
    'from-indigo-400 to-indigo-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function computeAge(birthdate?: string, birthYear?: number): number | null {
  const now = new Date();
  if (birthdate) {
    const bd = new Date(birthdate);
    let age = now.getFullYear() - bd.getFullYear();
    const monthDiff = now.getMonth() - bd.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) {
      age--;
    }
    return age;
  }
  if (birthYear) {
    return now.getFullYear() - birthYear;
  }
  return null;
}

export function ChildCard({ child, onClick, onEdit, onArchive }: ChildCardProps) {
  const t = useTranslations('Children');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const age = computeAge(child.birthdate, child.birth_year);
  const gradeLabel = child.grade_level ? GRADE_LABELS[child.grade_level] ?? child.grade_level : null;
  const displayName = child.nickname ? child.nickname : child.first_name;
  const fullLabel = child.nickname ? `${child.nickname} (${child.first_name})` : child.first_name;
  const initials = getInitials(displayName);
  const colorClass = getInitialColor(child.first_name);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer relative group"
      onClick={onClick}
    >
      {/* Context Menu */}
      <div ref={menuRef} className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]">
            <button
              onClick={() => { setMenuOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="w-4 h-4" />
              {t('edit')}
            </button>
            <button
              onClick={() => { setMenuOpen(false); onArchive(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Archive className="w-4 h-4" />
              {t('archive')}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-bold text-lg">{initials}</span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-800 text-lg truncate">{fullLabel}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {age !== null && (
              <span className="text-sm text-slate-500">{t('yearsOld', { age })}</span>
            )}
            {gradeLabel && (
              <span className="text-sm text-slate-500">{gradeLabel}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {child.child_curriculum.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {child.child_curriculum[0]}
              </span>
            )}
            {child.learning_styles.length > 0 && (
              child.learning_styles.map(ls => (
                <span key={ls} className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                  {LEARNING_STYLE_LABELS[ls] ?? ls}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
