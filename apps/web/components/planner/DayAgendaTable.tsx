'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Clock, HelpCircle, StickyNote, UserRound, Users, icons } from 'lucide-react';
import {
  ChildData,
  RoutineEntryData,
  SubjectData,
  isCustomActivity,
  minuteToTime,
  parseCustomNotes,
  priorityColor,
} from './types';
import { DaySchedule, FAMILY_COLUMN_ID } from './dayView';
import { FamilyParent, getParentDisplayName } from '../../hooks/useFamilyParents';
import { TYPE_ICONS } from '../resources/resourceTypeIcons';
import { getChildDisplayName, getChildInitials } from '../../lib/childDisplay';

export interface DayResource {
  id: string;
  title: string;
  type: string;
  progress_notes: string | null;
}

interface DayAgendaTableProps {
  schedule: DaySchedule;
  subjectsById: Record<string, SubjectData>;
  parentsById: Record<string, FamilyParent>;
  resourcesBySubject: Record<string, DayResource[]>;
  childrenList: ChildData[];
  variant?: 'screen' | 'print';
}

function childLabel(child: ChildData): string {
  return getChildDisplayName({ first_name: child.first_name ?? child.name, nickname: child.nickname });
}

function childInitials(child: ChildData): string {
  return getChildInitials({ first_name: child.first_name ?? child.name, nickname: child.nickname });
}

export function DayAgendaTable({
  schedule,
  subjectsById,
  parentsById,
  resourcesBySubject,
  childrenList,
  variant = 'screen',
}: DayAgendaTableProps) {
  const t = useTranslations('WeekPlanner');
  const isPrint = variant === 'print';
  const { columns, rows } = schedule;

  const gridTemplateColumns = isPrint
    ? `14mm repeat(${columns.length}, minmax(0, 1fr))`
    : `4.5rem repeat(${columns.length}, minmax(15rem, 1fr))`;

  return (
    <div className={isPrint ? '' : 'overflow-x-auto'}>
      <div
        className={`grid ${isPrint ? 'border border-slate-200 rounded' : 'min-w-fit border border-slate-200 rounded-xl bg-white'}`}
        style={{ gridTemplateColumns }}
        role="table"
        aria-label={t('dayViewTableLabel')}
      >
        {/* Header row */}
        <div role="row" className="contents">
          <div
            role="columnheader"
            className={`border-b border-slate-200 bg-slate-50 ${isPrint ? 'p-1' : 'p-3 rounded-tl-xl'}`}
          >
            <span className="sr-only">{t('dayViewTime')}</span>
          </div>
          {columns.map((col, i) => (
            <div
              key={col.id}
              role="columnheader"
              className={`border-b border-l border-slate-200 bg-slate-50 flex items-center gap-2 ${
                isPrint ? 'px-2 py-1' : 'px-3 py-2.5'
              } ${!isPrint && i === columns.length - 1 ? 'rounded-tr-xl' : ''}`}
            >
              <span
                className={`rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0 ${
                  isPrint ? 'w-5 h-5 text-[9px]' : 'w-8 h-8 text-sm'
                }`}
              >
                {col.child ? childInitials(col.child) : <Users className="w-4 h-4" />}
              </span>
              <span className={`font-semibold text-slate-800 truncate ${isPrint ? 'text-[11px]' : 'text-sm'}`}>
                {col.child ? childLabel(col.child) : t('dayViewFamilyColumn')}
              </span>
            </div>
          ))}
        </div>

        {/* Time rows */}
        {rows.map((row, rowIdx) => {
          const isLastRow = rowIdx === rows.length - 1;
          return (
            <div key={row.startMinute} role="row" className="contents">
              <div
                role="rowheader"
                className={`border-slate-200 text-slate-500 font-medium ${isLastRow ? '' : 'border-b'} ${
                  isPrint ? 'p-1 text-[9px]' : 'p-3 text-xs'
                }`}
              >
                {minuteToTime(row.startMinute)}
              </div>
              {columns.map((col) => (
                <div
                  key={col.id}
                  role="cell"
                  className={`border-l border-slate-200 ${isLastRow ? '' : 'border-b'} ${
                    isPrint ? 'p-1 space-y-1' : 'p-2 space-y-2'
                  }`}
                >
                  {(row.cells[col.id] ?? []).map((entry) => (
                    <DayEntryCard
                      key={entry.id}
                      entry={entry}
                      columnId={col.id}
                      subject={entry.subject_id ? subjectsById[entry.subject_id] ?? null : null}
                      parentsById={parentsById}
                      resourcesBySubject={resourcesBySubject}
                      childrenList={childrenList}
                      isPrint={isPrint}
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayEntryCardProps {
  entry: RoutineEntryData;
  columnId: string;
  subject: SubjectData | null;
  parentsById: Record<string, FamilyParent>;
  resourcesBySubject: Record<string, DayResource[]>;
  childrenList: ChildData[];
  isPrint: boolean;
}

function EntryIcon({ entry, subject, color, isPrint }: { entry: RoutineEntryData; subject: SubjectData | null; color: string; isPrint: boolean }) {
  const size = isPrint ? 'w-3.5 h-3.5' : 'w-5 h-5';
  const box = isPrint ? 'w-6 h-6 rounded-md text-xs' : 'w-9 h-9 rounded-lg text-lg';
  let content: React.ReactNode;
  if (entry.is_free_time) {
    content = <span aria-hidden>🌿</span>;
  } else if (isCustomActivity(entry)) {
    content = <span aria-hidden>{parseCustomNotes(entry.notes).icon}</span>;
  } else if (subject?.icon && subject.icon in icons) {
    content = React.createElement(icons[subject.icon as keyof typeof icons], { className: size, style: { color } });
  } else {
    content = <BookOpen className={size} style={{ color }} />;
  }
  return (
    <span
      className={`${box} flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: entry.is_free_time ? '#dcfce7' : `${color}1f` }}
    >
      {content}
    </span>
  );
}

function DayEntryCard({ entry, columnId, subject, parentsById, resourcesBySubject, childrenList, isPrint }: DayEntryCardProps) {
  const t = useTranslations('WeekPlanner');
  const custom = isCustomActivity(entry);
  const customData = custom ? parseCustomNotes(entry.notes) : null;
  const color = entry.is_free_time ? '#22C55E' : entry.color || subject?.color || '#6366F1';

  let name: string;
  let notes: string;
  if (entry.is_free_time) {
    const [label, ...rest] = (entry.notes ?? '').split('\n');
    name = label || t('freeTime');
    notes = rest.join('\n').trim();
  } else if (custom) {
    name = customData!.name;
    notes = customData!.userNotes.trim();
  } else {
    name = subject?.name ?? t('dayViewUnknownSubject');
    notes = (entry.notes ?? '').trim();
  }

  const end = entry.start_minute + entry.duration_minutes;
  const duration =
    entry.duration_minutes >= 60
      ? t('hours', { h: Math.floor(entry.duration_minutes / 60), m: entry.duration_minutes % 60 })
      : t('minutes', { count: entry.duration_minutes });

  const responsible = subject?.responsible_member_id ? parentsById[subject.responsible_member_id] : undefined;
  const resources = subject ? resourcesBySubject[subject.id] ?? [] : [];
  const others = childrenList
    .filter((c) => c.id !== columnId && entry.child_ids.includes(c.id))
    .map(childLabel);

  const text = isPrint ? 'text-[9px] leading-tight' : 'text-xs';
  const iconSize = isPrint ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <article
      className={`border border-slate-200 bg-white ${isPrint ? 'rounded p-1.5' : 'rounded-lg p-3 shadow-sm'} ${
        entry.is_free_time ? 'border-dashed !border-green-300 !bg-green-50/60' : ''
      }`}
      style={{
        borderLeftWidth: entry.is_free_time ? undefined : isPrint ? 3 : 4,
        borderLeftColor: entry.is_free_time ? undefined : color,
        breakInside: 'avoid',
      }}
    >
      <div className={`flex items-start ${isPrint ? 'gap-1.5' : 'gap-2.5'}`}>
        <EntryIcon entry={entry} subject={subject} color={color} isPrint={isPrint} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className={`font-semibold text-slate-800 ${isPrint ? 'text-[11px] leading-tight' : 'text-sm truncate'}`}>
              {name}
            </h4>
            {!entry.is_free_time && (
              <span
                className={`rounded-full flex-shrink-0 ${isPrint ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${priorityColor(entry.priority)}`}
                title={t(`priority${entry.priority.charAt(0).toUpperCase()}${entry.priority.slice(1)}`)}
              />
            )}
          </div>
          <p className={`flex items-center gap-1 text-slate-500 ${text}`}>
            <Clock className={iconSize} />
            {minuteToTime(entry.start_minute)}–{minuteToTime(end)} · {duration}
          </p>
        </div>
      </div>

      {(subject?.short_description || responsible || resources.length > 0 || notes || others.length > 0) && (
        <div className={`${isPrint ? 'mt-1 space-y-0.5' : 'mt-2.5 space-y-1.5'} ${text} text-slate-600`}>
          {subject?.short_description && (
            <p className={`text-slate-500 ${isPrint ? '' : 'line-clamp-2'}`}>{subject.short_description}</p>
          )}
          {responsible && (
            <p className="flex items-center gap-1">
              <UserRound className={`${iconSize} flex-shrink-0 text-slate-400`} />
              <span>{t('dayViewTaughtBy', { name: getParentDisplayName(responsible) })}</span>
            </p>
          )}
          {resources.length > 0 && (
            <ul className={isPrint ? 'space-y-0.5' : 'space-y-1'} aria-label={t('dayViewResources')}>
              {resources.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? HelpCircle;
                return (
                  <li key={r.id} className="flex items-start gap-1">
                    <Icon className={`${iconSize} flex-shrink-0 text-slate-400 mt-px`} />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-700">{r.title}</span>
                      {r.progress_notes && <span className="text-slate-500"> · {r.progress_notes}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {notes && (
            <p className="flex items-start gap-1 whitespace-pre-line">
              <StickyNote className={`${iconSize} flex-shrink-0 text-slate-400 mt-px`} />
              <span>{notes}</span>
            </p>
          )}
          {others.length > 0 && (
            <p className="flex items-center gap-1 text-slate-500">
              <Users className={`${iconSize} flex-shrink-0 text-slate-400`} />
              <span>{t('dayViewTogetherWith', { names: others.join(', ') })}</span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
