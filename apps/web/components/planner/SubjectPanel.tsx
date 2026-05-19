'use client';

import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Leaf, Pencil, BookOpen, icons } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  SubjectData, ChildData, CurriculumData, RoutineEntryData, priorityFromNumber, priorityColor, DragSubjectPayload,
  CUSTOM_COLORS,
} from './types';

interface SubjectPanelProps {
  subjects: SubjectData[];
  childrenList: ChildData[];
  curriculums: CurriculumData[];
  entries: RoutineEntryData[];
  collapsed: boolean;
  onToggle: () => void;
}

export function SubjectPanel({ subjects, childrenList, curriculums, entries, collapsed, onToggle }: SubjectPanelProps) {
  const t = useTranslations('WeekPlanner');

  // Build subjectId -> eligible children (active child whose active curriculum contains the subject)
  const subjectChildMap = useMemo(() => {
    const map = new Map<string, ChildData[]>();
    const activeChildren = childrenList.filter(c => c.is_active);
    const activeCurriculums = curriculums.filter(c => c.status === 'active');

    for (const subject of subjects) {
      const eligible: ChildData[] = [];
      for (const child of activeChildren) {
        const childCurriculums = activeCurriculums.filter(
          c => c.child_curriculums.some(cc => cc.child_id === child.id)
        );
        const hasSubject = childCurriculums.some(
          c => c.curriculum_subjects.some(cs => cs.subject_id === subject.id && cs.is_active)
        );
        if (hasSubject) eligible.push(child);
      }
      if (eligible.length > 0) map.set(subject.id, eligible);
    }
    return map;
  }, [subjects, childrenList, curriculums]);

  // Visible subjects: those with at least one eligible child, sorted by name
  const visibleSubjects = useMemo(() => {
    return subjects
      .filter(s => subjectChildMap.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [subjects, subjectChildMap]);

  // Per-subject child-chip selection (default: all eligible children selected)
  const [selectionOverrides, setSelectionOverrides] = useState<Map<string, Set<string>>>(new Map());

  function getSelected(subjectId: string): Set<string> {
    const override = selectionOverrides.get(subjectId);
    if (override) return override;
    const eligible = subjectChildMap.get(subjectId) || [];
    return new Set(eligible.map(c => c.id));
  }

  function toggleChild(subjectId: string, childId: string) {
    setSelectionOverrides(prev => {
      const next = new Map(prev);
      const current = new Set(next.get(subjectId) || getSelected(subjectId));
      if (current.has(childId)) current.delete(childId);
      else current.add(childId);
      next.set(subjectId, current);
      return next;
    });
  }

  const hasActiveCurriculum = curriculums.some(
    c => c.status === 'active' &&
      c.child_curriculums.some(cc => childrenList.some(ch => ch.is_active && ch.id === cc.child_id))
  );

  return (
    <div
      className={`flex-shrink-0 border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-72'
      }`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        {!collapsed && (
          <h3 className="text-sm font-semibold text-slate-700">{t('subjectsHeader')}</h3>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 49px)' }}>
          {/* Free Time tile */}
          <div className="p-3 border-b border-slate-100">
            <FreeTimeTile />
          </div>

          {/* Custom Activity tile */}
          <div className="p-3 border-b border-slate-100">
            <CustomActivityTile />
          </div>

          {/* Subjects */}
          <div className="p-3 space-y-2">
            {!hasActiveCurriculum ? (
              <p className="text-xs text-slate-400 italic py-2">{t('noCurriculum')}</p>
            ) : visibleSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">{t('noSubjectsInCurriculum')}</p>
            ) : (
              visibleSubjects.map(subject => {
                const eligible = subjectChildMap.get(subject.id) || [];
                const selected = getSelected(subject.id);
                const entryCount = entries.filter(e => e.subject_id === subject.id).length;
                return (
                  <DraggableSubjectTile
                    key={`tile-${subject.id}`}
                    subject={subject}
                    eligibleChildren={eligible}
                    selectedChildIds={selected}
                    onToggleChild={(childId) => toggleChild(subject.id, childId)}
                    entryCount={entryCount}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FreeTimeTile() {
  const t = useTranslations('WeekPlanner');
  const payload: DragSubjectPayload = {
    type: 'subject',
    subjectId: '__free_time__',
    childIds: [],
    isFreeTime: true,
    color: '#22c55e',
    priority: 'low',
    durationMinutes: 60,
    subjectName: t('freeTime'),
    icon: null,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'free-time-tile',
    data: payload,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-green-300 bg-green-50 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <Leaf className="w-5 h-5 text-green-600 flex-shrink-0" />
      <span className="text-sm font-medium text-green-800 truncate">{t('freeTime')}</span>
    </div>
  );
}

function CustomActivityTile() {
  const t = useTranslations('WeekPlanner');

  const payload: DragSubjectPayload = {
    type: 'subject',
    subjectId: '__custom__',
    childIds: [],
    isFreeTime: false,
    color: CUSTOM_COLORS[10],
    priority: 'medium',
    durationMinutes: 45,
    subjectName: t('customActivity'),
    icon: '✏️',
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'custom-activity-tile',
    data: payload,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <Pencil className="w-5 h-5 text-slate-600 flex-shrink-0" />
      <span className="text-sm font-medium text-slate-700 truncate">{t('customActivity')}</span>
    </div>
  );
}

function SubjectIcon({ iconName, color }: { iconName: string | null; color: string }) {
  const name = iconName || 'BookOpen';
  if (name in icons) {
    return React.createElement(icons[name as keyof typeof icons], {
      className: 'w-4 h-4 flex-shrink-0',
      style: { color },
    });
  }
  return <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color }} />;
}

interface DraggableSubjectTileProps {
  subject: SubjectData;
  eligibleChildren: ChildData[];
  selectedChildIds: Set<string>;
  onToggleChild: (childId: string) => void;
  entryCount: number;
}

function DraggableSubjectTile({
  subject,
  eligibleChildren,
  selectedChildIds,
  onToggleChild,
  entryCount,
}: DraggableSubjectTileProps) {
  const t = useTranslations('WeekPlanner');
  const priority = priorityFromNumber(subject.priority);
  const isOnGrid = entryCount > 0;
  const selectedIdsArray = eligibleChildren
    .map(c => c.id)
    .filter(id => selectedChildIds.has(id));
  const hasSelection = selectedIdsArray.length > 0;

  const payload: DragSubjectPayload = {
    type: 'subject',
    subjectId: subject.id,
    childIds: selectedIdsArray,
    isFreeTime: false,
    color: subject.color,
    priority,
    durationMinutes: subject.default_session_duration_minutes || 45,
    subjectName: subject.name,
    icon: subject.icon,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tile-${subject.id}`,
    data: payload,
    disabled: !hasSelection,
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-2 rounded-lg border select-none transition-shadow ${
        hasSelection ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : 'cursor-not-allowed opacity-60'
      } ${isDragging ? 'opacity-50' : ''} ${
        isOnGrid ? 'bg-primary/5 border-primary/30' : 'bg-white border-slate-200'
      }`}
      style={{ borderLeftWidth: '4px', borderLeftColor: subject.color }}
    >
      {/* Drag handle area: name + icon + priority */}
      <div
        {...(hasSelection ? listeners : {})}
        {...attributes}
        className="flex items-center gap-1.5"
      >
        <SubjectIcon iconName={subject.icon} color={subject.color} />
        <span className="text-sm font-medium text-slate-800 truncate">{subject.name}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ml-auto ${priorityColor(priority)}`} />
      </div>

      {/* Child chips */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {eligibleChildren.map(child => {
          const isSelected = selectedChildIds.has(child.id);
          const displayName = child.nickname || child.name;
          return (
            <button
              key={child.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onToggleChild(child.id)}
              className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-primary/30 text-primary-dark'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
              }`}
              aria-pressed={isSelected}
            >
              {displayName}
            </button>
          );
        })}
      </div>

      {isOnGrid && (
        <div className="mt-1">
          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            {t('timesPerWeek', { count: entryCount })}
          </span>
        </div>
      )}
    </div>
  );
}
