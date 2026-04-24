'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { ALL_STATUSES, ALL_ENTITY_TYPES } from './types';
import type { NoteStatus, NoteEntityType } from './types';
import { statusLabelKey } from './StatusBadge';

type EntityFilterKey =
  | 'filterChildren'
  | 'filterSubjects'
  | 'filterResources'
  | 'filterEvents'
  | 'filterProjects';

function entityFilterKey(type: NoteEntityType): EntityFilterKey {
  switch (type) {
    case 'child':
      return 'filterChildren';
    case 'subject':
      return 'filterSubjects';
    case 'resource':
      return 'filterResources';
    case 'event':
      return 'filterEvents';
    case 'project':
      return 'filterProjects';
  }
}

export interface FiltersState {
  q: string;
  statuses: NoteStatus[];
  entityType: NoteEntityType | 'general' | null; // null = All
  pinned: boolean;
  overdue: boolean;
  tag: string | null;
}

interface Props {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  allTags: string[];
}

export function NoteFilters({ filters, onChange, allTags }: Props) {
  const t = useTranslations('Notes');

  function toggleStatus(s: NoteStatus) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  }

  function setEntity(v: NoteEntityType | 'general' | null) {
    onChange({ ...filters, entityType: v });
  }

  function clear() {
    onChange({
      q: '',
      statuses: [],
      entityType: null,
      pinned: false,
      overdue: false,
      tag: null,
    });
  }

  const hasActive =
    filters.q.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.entityType !== null ||
    filters.pinned ||
    filters.overdue ||
    filters.tag !== null;

  return (
    <aside className="bg-white rounded-xl border border-slate-200 p-4 space-y-5 sticky top-4">
      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder={t('search')}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
          />
        </div>
      </div>

      {/* Status */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t('filterByStatus')}
        </h3>
        <div className="space-y-1">
          {ALL_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.statuses.includes(s)}
                onChange={() => toggleStatus(s)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(statusLabelKey(s))}
            </label>
          ))}
        </div>
      </div>

      {/* Entity */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t('filterByEntity')}
        </h3>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="entity"
              checked={filters.entityType === null}
              onChange={() => setEntity(null)}
              className="w-4 h-4 border-slate-300 text-primary focus:ring-primary"
            />
            {t('filterAll')}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="entity"
              checked={filters.entityType === 'general'}
              onChange={() => setEntity('general')}
              className="w-4 h-4 border-slate-300 text-primary focus:ring-primary"
            />
            {t('filterGeneral')}
          </label>
          {ALL_ENTITY_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                name="entity"
                checked={filters.entityType === type}
                onChange={() => setEntity(type)}
                className="w-4 h-4 border-slate-300 text-primary focus:ring-primary"
              />
              {t(entityFilterKey(type))}
            </label>
          ))}
        </div>
      </div>

      {/* Quick filters */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t('filtersHeading')}
        </h3>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.pinned}
            onChange={(e) => onChange({ ...filters, pinned: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          {t('filterPinned')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(e) => onChange({ ...filters, overdue: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          {t('filterOverdue')}
        </label>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {t('filterByTag')}
          </h3>
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onChange({ ...filters, tag: filters.tag === tag ? null : tag })}
                className={`text-xs rounded-md px-2 py-0.5 ${
                  filters.tag === tag
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActive && (
        <button
          onClick={clear}
          className="text-sm text-primary hover:text-primary-hover font-medium"
        >
          {t('clearFilters')}
        </button>
      )}
    </aside>
  );
}
