'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MiniCalendar } from './MiniCalendar';
import { CalendarChild, EventType, EVENT_TYPE_COLORS } from './types';

interface CalendarSidebarProps {
  currentDate: Date;
  onDateChange: (d: Date) => void;
  daysWithEvents: Set<string>;
  childrenList: CalendarChild[];
  selectedChildIds: Set<string>;
  includeFamilyEvents: boolean;
  onToggleChild: (id: string) => void;
  onToggleFamily: () => void;
  typeFilters: Set<EventType | 'system'>;
  onToggleType: (t: EventType | 'system') => void;
}

export function CalendarSidebar({
  currentDate,
  onDateChange,
  daysWithEvents,
  childrenList,
  selectedChildIds,
  includeFamilyEvents,
  onToggleChild,
  onToggleFamily,
  typeFilters,
  onToggleType,
}: CalendarSidebarProps) {
  const t = useTranslations('Calendar');

  const typeKeys: { key: EventType | 'system'; label: string }[] = [
    { key: 'family', label: t('eventTypeFamily') },
    { key: 'subject', label: t('eventTypeSubject') },
    { key: 'project', label: t('eventTypeProject') },
    { key: 'curriculum', label: t('eventTypeCurriculum') },
  ];

  return (
    <aside className="w-60 border-r border-slate-200 bg-white p-4 overflow-y-auto flex-shrink-0">
      <MiniCalendar
        value={currentDate}
        onChange={onDateChange}
        daysWithEvents={daysWithEvents}
      />

      {childrenList.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {t('children')}
          </h3>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onToggleFamily}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                includeFamilyEvents ? 'bg-primary/5 text-slate-800' : 'text-slate-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                includeFamilyEvents ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
              }`}>
                ★
              </span>
              <span>{t('wholeFamily')}</span>
            </button>
            {childrenList.map((c) => {
              const on = selectedChildIds.has(c.id);
              const initials = c.avatar_initials || c.first_name[0];
              const display = c.nickname || c.first_name;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggleChild(c.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    on ? 'bg-primary/5 text-slate-800' : 'text-slate-400'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    on ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {initials}
                  </span>
                  <span className="truncate">{display}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t('categories')}
        </h3>
        <div className="flex flex-col gap-1">
          {typeKeys.map(({ key, label }) => {
            const on = typeFilters.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleType(key)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  on ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: on ? EVENT_TYPE_COLORS[key] : '#e2e8f0' }}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
