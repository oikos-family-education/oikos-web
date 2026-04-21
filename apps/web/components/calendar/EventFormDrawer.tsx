'use client';

import React, { useMemo } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@oikos/ui';
import {
  CalendarEvent,
  CalendarChild,
  CalendarSubject,
  CalendarProject,
  EventType,
  Recurrence,
  COLOR_PRESETS,
  EVENT_TYPE_COLORS,
  toISODate,
  fromISODate,
  parseServerDate,
  minuteToTime,
  parseTime,
} from './types';

interface EventFormDrawerProps {
  event: CalendarEvent | null;
  defaultDate?: Date;
  defaultHour?: number;
  childrenList: CalendarChild[];
  subjects: CalendarSubject[];
  projects: CalendarProject[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

interface FormValues {
  title: string;
  description: string;
  event_type: EventType;
  all_day: boolean;
  date: string;
  start_time: string;
  end_time: string;
  subject_id: string;
  project_id: string;
  milestone_id: string;
  recurrence: Recurrence;
  location: string;
}

export function EventFormDrawer({
  event,
  defaultDate,
  defaultHour,
  childrenList,
  subjects,
  projects,
  onClose,
  onSaved,
  onDeleted,
}: EventFormDrawerProps) {
  const t = useTranslations('Calendar');
  const isEditing = !!event;
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const initial = useMemo(() => {
    if (event) {
      const start = parseServerDate(event.start_at);
      const end = parseServerDate(event.end_at);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      return {
        title: event.title,
        description: event.description ?? '',
        event_type: event.event_type,
        all_day: event.all_day,
        date: toISODate(start),
        start_time: minuteToTime(startMin),
        end_time: minuteToTime(endMin),
        subject_id: event.subject_id ?? '',
        project_id: event.project_id ?? '',
        milestone_id: event.milestone_id ?? '',
        recurrence: event.recurrence,
        location: event.location ?? '',
        child_ids: event.child_ids,
        color: event.color,
      };
    }
    const base = defaultDate ?? new Date();
    const h = typeof defaultHour === 'number' ? defaultHour : 9;
    const startMin = h * 60;
    const endMin = Math.min(22 * 60, startMin + 60);
    return {
      title: '',
      description: '',
      event_type: 'family' as EventType,
      all_day: false,
      date: toISODate(base),
      start_time: minuteToTime(startMin),
      end_time: minuteToTime(endMin),
      subject_id: '',
      project_id: '',
      milestone_id: '',
      recurrence: 'none' as Recurrence,
      location: '',
      child_ids: [] as string[],
      color: null as string | null,
    };
  }, [event, defaultDate, defaultHour]);

  const [selectedChildIds, setSelectedChildIds] = React.useState<string[]>(initial.child_ids);
  const [color, setColor] = React.useState<string | null>(initial.color);

  const schema = useMemo(
    () =>
      z
        .object({
          title: z.string().min(1, t('titleRequired')).max(255),
          description: z.string().optional().or(z.literal('')),
          event_type: z.enum(['family', 'subject', 'project', 'curriculum']),
          all_day: z.boolean(),
          date: z.string().min(1),
          start_time: z.string(),
          end_time: z.string(),
          subject_id: z.string().optional().or(z.literal('')),
          project_id: z.string().optional().or(z.literal('')),
          milestone_id: z.string().optional().or(z.literal('')),
          recurrence: z.enum(['none', 'weekly', 'monthly', 'yearly']),
          location: z.string().optional().or(z.literal('')),
        })
        .refine(
          (v) => {
            if (v.event_type !== 'subject') return true;
            return !!v.subject_id;
          },
          { message: t('subjectRequired'), path: ['subject_id'] }
        )
        .refine(
          (v) => {
            if (v.event_type !== 'project') return true;
            return !!v.project_id;
          },
          { message: t('projectRequired'), path: ['project_id'] }
        )
        .refine(
          (v) => {
            if (v.all_day) return true;
            const s = parseTime(v.start_time);
            const e = parseTime(v.end_time);
            if (s === null || e === null) return false;
            return e > s;
          },
          { message: t('endTimeBeforeStart'), path: ['end_time'] }
        ),
    [t]
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      title: initial.title,
      description: initial.description,
      event_type: initial.event_type,
      all_day: initial.all_day,
      date: initial.date,
      start_time: initial.start_time,
      end_time: initial.end_time,
      subject_id: initial.subject_id,
      project_id: initial.project_id,
      milestone_id: initial.milestone_id,
      recurrence: initial.recurrence,
      location: initial.location,
    },
  });

  const eventType = watch('event_type');
  const allDay = watch('all_day');
  const projectId = watch('project_id');

  const milestones = useMemo(() => {
    const selectedProject = projects.find((p) => p.id === projectId);
    return selectedProject?.milestones || [];
  }, [projects, projectId]);

  React.useEffect(() => {
    if (eventType !== 'subject') setValue('subject_id', '');
    if (eventType !== 'project') {
      setValue('project_id', '');
      setValue('milestone_id', '');
    }
  }, [eventType, setValue]);

  React.useEffect(() => {
    if (!milestones.some((m) => m.id === watch('milestone_id'))) {
      setValue('milestone_id', '');
    }
  }, [projectId, milestones, setValue, watch]);

  function toggleChild(id: string) {
    setSelectedChildIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildServerDate(dateStr: string, time: string, endOfDay: boolean): string {
    const d = fromISODate(dateStr);
    if (endOfDay) {
      d.setHours(23, 59, 59, 999);
    } else {
      const m = parseTime(time);
      if (m !== null) {
        d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      }
    }
    return d.toISOString();
  }

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    setError('');

    let start_at: string;
    let end_at: string;
    if (values.all_day) {
      const day = fromISODate(values.date);
      day.setHours(0, 0, 0, 0);
      start_at = day.toISOString();
      end_at = buildServerDate(values.date, '', true);
    } else {
      start_at = buildServerDate(values.date, values.start_time, false);
      end_at = buildServerDate(values.date, values.end_time, false);
    }

    const body = {
      title: values.title,
      description: values.description || null,
      event_type: values.event_type,
      all_day: values.all_day,
      start_at,
      end_at,
      child_ids: selectedChildIds,
      subject_id: values.event_type === 'subject' ? values.subject_id || null : null,
      project_id: values.event_type === 'project' ? values.project_id || null : null,
      milestone_id:
        values.event_type === 'project' && values.milestone_id ? values.milestone_id : null,
      color,
      location: values.location || null,
      recurrence: values.recurrence,
    };

    const url = isEditing ? `/api/v1/calendar/events/${event!.id}` : '/api/v1/calendar/events';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSaved();
    } else {
      const err = await res.json().catch(() => null);
      setError(err?.detail || 'Something went wrong.');
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!event) return;
    setIsLoading(true);
    const res = await fetch(`/api/v1/calendar/events/${event.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      onDeleted();
    } else {
      const err = await res.json().catch(() => null);
      setError(err?.detail || 'Something went wrong.');
    }
    setIsLoading(false);
  }

  const typeOptions: { key: EventType; label: string }[] = [
    { key: 'family', label: t('eventTypeFamily') },
    { key: 'subject', label: t('eventTypeSubject') },
    { key: 'project', label: t('eventTypeProject') },
  ];

  const recurrenceOptions: { value: Recurrence; label: string }[] = [
    { value: 'none', label: t('recurrenceNone') },
    { value: 'weekly', label: t('recurrenceWeekly') },
    { value: 'monthly', label: t('recurrenceMonthly') },
    { value: 'yearly', label: t('recurrenceYearly') },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={onClose}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-xl overflow-hidden flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">
            {isEditing ? t('editEvent') : t('addEvent')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <Input
            label={t('titleLabel')}
            placeholder={t('titlePlaceholder')}
            required
            error={errors.title?.message}
            {...register('title')}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('typeLabel')}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {typeOptions.map((opt) => {
                const selected = eventType === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setValue('event_type', opt.key, { shouldValidate: true })}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="all-day"
              type="checkbox"
              className="w-4 h-4 rounded text-primary focus:ring-primary"
              {...register('all_day')}
            />
            <label htmlFor="all-day" className="text-sm text-slate-700">
              {t('allDayLabel')}
            </label>
          </div>

          <Input
            type="date"
            label={t('dateLabel')}
            required
            error={errors.date?.message}
            {...register('date')}
          />

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="time"
                step={900}
                label={t('startTimeLabel')}
                required
                error={errors.start_time?.message}
                {...register('start_time')}
              />
              <Input
                type="time"
                step={900}
                label={t('endTimeLabel')}
                required
                error={errors.end_time?.message}
                {...register('end_time')}
              />
            </div>
          )}

          {eventType === 'subject' && (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                {t('subjectLabel')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.subject_id ? 'border-red-500' : 'border-slate-200'
                }`}
                {...register('subject_id')}
              >
                <option value="">{t('subjectPlaceholder')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.subject_id?.message && (
                <span className="text-xs font-medium text-red-500 mt-0.5">
                  {errors.subject_id.message}
                </span>
              )}
            </div>
          )}

          {eventType === 'project' && (
            <>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                  {t('projectLabel')}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.project_id ? 'border-red-500' : 'border-slate-200'
                  }`}
                  {...register('project_id')}
                >
                  <option value="">{t('projectPlaceholder')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {errors.project_id?.message && (
                  <span className="text-xs font-medium text-red-500 mt-0.5">
                    {errors.project_id.message}
                  </span>
                )}
              </div>
              {milestones.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                    {t('milestoneLabel')}
                  </label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    {...register('milestone_id')}
                  >
                    <option value="">{t('milestonePlaceholder')}</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {childrenList.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                {t('childrenLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {childrenList.map((c) => {
                  const selected = selectedChildIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChild(c.id)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {c.nickname || c.first_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('recurrenceLabel')}
            </label>
            <select
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              {...register('recurrence')}
            >
              {recurrenceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={t('locationLabel')}
            placeholder={t('locationPlaceholder')}
            error={errors.location?.message}
            {...register('location')}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('descriptionLabel')}
            </label>
            <textarea
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              {...register('description')}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              {t('colorLabel')}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] text-slate-500 ${
                  color === null ? 'border-primary' : 'border-slate-200'
                }`}
                title={t('defaultColor')}
                style={{ backgroundColor: `${EVENT_TYPE_COLORS[eventType]}20` }}
              >
                ✕
              </button>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-2">
          {isEditing && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4" />
              {t('deleteEvent')}
            </button>
          )}
          {isEditing && confirmDelete && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600">{t('deleteConfirm')}</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-2 py-1 text-red-500 font-semibold hover:text-red-600"
                disabled={isLoading}
              >
                {t('deleteEvent')}
              </button>
            </div>
          )}
          {!isEditing && <div />}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
              disabled={isLoading}
            >
              {t('cancel')}
            </button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('saveEvent')
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
