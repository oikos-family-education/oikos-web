'use client';

import React from 'react';
import { X, MapPin, Users, BookOpen, Layers, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import {
  CalendarEvent,
  CalendarChild,
  CalendarSubject,
  CalendarProject,
  getEventColor,
  parseServerDate,
  EVENT_TYPE_COLORS,
} from './types';

interface EventDetailDrawerProps {
  event: CalendarEvent;
  childrenList: CalendarChild[];
  subjects: CalendarSubject[];
  projects: CalendarProject[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigateSource?: (url: string) => void;
}

export function EventDetailDrawer({
  event,
  childrenList,
  subjects,
  projects,
  onClose,
  onEdit,
  onDelete,
  onNavigateSource,
}: EventDetailDrawerProps) {
  const t = useTranslations('Calendar');
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const color = getEventColor(event);
  const start = parseServerDate(event.start_at);
  const end = parseServerDate(event.end_at);

  const dateStr = start.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = event.all_day
    ? t('allDay')
    : `${formatTime(start)} – ${formatTime(end)}`;

  const recurrenceLabel = event.recurrence === 'none'
    ? t('recurrenceNone')
    : t(`recurrence${capitalize(event.recurrence)}` as any);

  const assignedChildren = childrenList.filter((c) => event.child_ids.includes(c.id));
  const subject = subjects.find((s) => s.id === event.subject_id) || null;
  const project = projects.find((p) => p.id === event.project_id) || null;
  const milestone = project?.milestones?.find((m) => m.id === event.milestone_id) || null;

  const typeLabel = event.is_system
    ? t('eventTypeSystem')
    : t(`eventType${capitalize(event.event_type)}` as any);

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-xl overflow-y-auto flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {typeLabel}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800">{event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4">
          <div>
            <div className="text-sm text-slate-800 font-medium">{dateStr}</div>
            <div className="text-sm text-slate-500">{timeStr}</div>
            {event.recurrence !== 'none' && (
              <div className="text-xs text-slate-500 mt-1">{recurrenceLabel}</div>
            )}
          </div>

          {assignedChildren.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <Users className="w-3.5 h-3.5" />
                {t('childrenLabel')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedChildren.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-700"
                  >
                    {c.nickname || c.first_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {subject && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <BookOpen className="w-3.5 h-3.5" />
                {t('subjectLabel')}
              </div>
              <div
                className="inline-block px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${subject.color}15`, color: subject.color }}
              >
                {subject.name}
              </div>
            </div>
          )}

          {project && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <Layers className="w-3.5 h-3.5" />
                {t('projectLabel')}
              </div>
              <div className="text-sm text-slate-700">{project.title}</div>
              {milestone && (
                <div className="text-xs text-slate-500 mt-1">
                  {t('milestoneLabel')}: {milestone.title}
                </div>
              )}
            </div>
          )}

          {event.location && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <MapPin className="w-3.5 h-3.5" />
                {t('locationLabel')}
              </div>
              <div className="text-sm text-slate-700">{event.location}</div>
            </div>
          )}

          {event.description && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {t('descriptionLabel')}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-2">
          {event.is_system && event.source_url ? (
            <Button
              type="button"
              onClick={() => onNavigateSource?.(event.source_url!)}
              className="w-full !bg-slate-700 hover:!bg-slate-800"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {event.event_type === 'curriculum' ? t('viewInCurriculum') : t('viewInProject')}
            </Button>
          ) : confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('cancel')}
              </button>
              <Button
                type="button"
                onClick={onDelete}
                className="!bg-red-500 hover:!bg-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('deleteEvent')}
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                {t('deleteEvent')}
              </button>
              <Button type="button" onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                {t('editEvent')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
