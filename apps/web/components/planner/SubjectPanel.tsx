'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Leaf, Pencil, BookOpen, icons } from 'lucide-react';
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

  return (
    <div
      className={`flex-shrink-0 border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-72'
      }`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        {!collapsed && (
          <h3 className="text-sm font-semibold text-slate-700">{t('curriculum')}</h3>
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

          {/* Subjects grouped by child */}
          {childrenList.filter(c => c.is_active).map(child => (
            <ChildSubjectGroup
              key={child.id}
              child={child}
              subjects={subjects}
              curriculums={curriculums}
              entries={entries}
            />
          ))}
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

interface ChildSubjectGroupProps {
  child: ChildData;
  subjects: SubjectData[];
  curriculums: CurriculumData[];
  entries: RoutineEntryData[];
}

function ChildSubjectGroup({ child, subjects, curriculums, entries }: ChildSubjectGroupProps) {
  const t = useTranslations('WeekPlanner');
  const [open, setOpen] = useState(true);

  const age = child.birthdate
    ? Math.floor((Date.now() - new Date(child.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : child.birth_year
    ? new Date().getFullYear() - child.birth_year
    : null;

  const displayName = child.nickname || child.name;

  // Find active curriculums for this child
  const childCurriculums = curriculums.filter(
    c => c.status === 'active' && c.child_curriculums.some(cc => cc.child_id === child.id)
  );

  // Get subject IDs from active curriculums
  const curriculumSubjectIds = new Set<string>();
  childCurriculums.forEach(c => {
    c.curriculum_subjects
      .filter(cs => cs.is_active)
      .forEach(cs => curriculumSubjectIds.add(cs.subject_id));
  });

  // Filter subjects to only those in the curriculum
  const filteredSubjects = subjects.filter(s => curriculumSubjectIds.has(s.id));

  const hasActiveCurriculum = childCurriculums.length > 0;
  const hasSubjects = filteredSubjects.length > 0;

  return (
    <div className="border-b border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-medium text-slate-700">
          {displayName}{age !== null ? ` · Age ${age}` : ''}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {!hasActiveCurriculum ? (
            <p className="text-xs text-slate-400 italic py-2">{t('noCurriculum')}</p>
          ) : !hasSubjects ? (
            <p className="text-xs text-slate-400 italic py-2">{t('noSubjectsInCurriculum')}</p>
          ) : (
            filteredSubjects.map(subject => {
              const entryCount = entries.filter(
                e => e.subject_id === subject.id && e.child_ids.includes(child.id)
              ).length;
              return (
                <DraggableSubjectTile
                  key={`${child.id}-${subject.id}`}
                  subject={subject}
                  child={child}
                  entryCount={entryCount}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface DraggableSubjectTileProps {
  subject: SubjectData;
  child: ChildData;
  entryCount: number;
}

function DraggableSubjectTile({ subject, child, entryCount }: DraggableSubjectTileProps) {
  const t = useTranslations('WeekPlanner');
  const priority = priorityFromNumber(subject.priority);
  const isOnGrid = entryCount > 0;
  const payload: DragSubjectPayload = {
    type: 'subject',
    subjectId: subject.id,
    childIds: [child.id],
    isFreeTime: false,
    color: subject.color,
    priority,
    durationMinutes: subject.default_session_duration_minutes || 45,
    subjectName: subject.name,
    icon: subject.icon,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tile-${child.id}-${subject.id}`,
    data: payload,
  });

  const displayName = child.nickname || child.name;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-2 rounded-lg border cursor-grab active:cursor-grabbing select-none hover:shadow-sm transition-shadow ${
        isDragging ? 'opacity-50' : ''
      } ${isOnGrid ? 'bg-primary/5 border-primary/30' : 'bg-white border-slate-200'}`}
      style={{ borderLeftWidth: '4px', borderLeftColor: subject.color }}
    >
      <div className="flex items-center gap-1.5">
        <SubjectIcon iconName={subject.icon} color={subject.color} />
        <span className="text-sm font-medium text-slate-800 truncate">{subject.name}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ml-auto ${priorityColor(priority)}`} />
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs text-slate-500 truncate">{displayName}</span>
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
