'use client';

import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../lib/navigation';
import { Button } from '@oikos/ui';
import { CalendarSidebar } from './CalendarSidebar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { EventDetailDrawer } from './EventDetailDrawer';
import { EventFormDrawer } from './EventFormDrawer';
import {
  CalendarEvent,
  CalendarChild,
  CalendarSubject,
  CalendarProject,
  CalendarMilestone,
  CalendarView,
  EventType,
  RoutineProjectionBlock,
  addDays,
  addMonths,
  buildWeekDays,
  endOfMonth,
  endOfWeek,
  parseServerDate,
  startOfMonth,
  startOfWeek,
  toISODate,
} from './types';

const VIEW_STORAGE_KEY = 'calendar-view';

const MONTH_KEYS = [
  'monthJanuary', 'monthFebruary', 'monthMarch', 'monthApril', 'monthMay', 'monthJune',
  'monthJuly', 'monthAugust', 'monthSeptember', 'monthOctober', 'monthNovember', 'monthDecember',
] as const;

function computeRange(view: CalendarView, date: Date): { from: Date; to: Date } {
  if (view === 'month') {
    return { from: startOfMonth(date), to: endOfMonth(date) };
  }
  if (view === 'week') {
    return { from: startOfWeek(date), to: endOfWeek(date) };
  }
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function CalendarPage() {
  const t = useTranslations('Calendar');
  const router = useRouter();

  const [view, setView] = React.useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [routineBlocks, setRoutineBlocks] = React.useState<RoutineProjectionBlock[]>([]);
  const [children, setChildren] = React.useState<CalendarChild[]>([]);
  const [subjects, setSubjects] = React.useState<CalendarSubject[]>([]);
  const [projects, setProjects] = React.useState<CalendarProject[]>([]);
  const [selectedChildIds, setSelectedChildIds] = React.useState<Set<string>>(new Set());
  const [includeFamilyEvents, setIncludeFamilyEvents] = React.useState(true);
  const [typeFilters, setTypeFilters] = React.useState<Set<EventType | 'system'>>(
    new Set<EventType | 'system'>(['family', 'subject', 'project', 'curriculum'])
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [createDefaults, setCreateDefaults] = React.useState<{ date?: Date; hour?: number }>({});

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null;
    if (stored === 'month' || stored === 'week' || stored === 'day') {
      setView(stored);
    }
  }, []);

  function changeView(next: CalendarView) {
    setView(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const [childRes, subjRes, projRes] = await Promise.all([
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
        fetch('/api/v1/projects?status=active', { credentials: 'include' }),
      ]);
      if (cancelled) return;

      if (childRes.ok) {
        const data = await childRes.json();
        setChildren(data);
      }
      if (subjRes.ok) {
        const data = await subjRes.json();
        setSubjects(data);
      }
      if (projRes.ok) {
        const list = await projRes.json();
        const details = await Promise.all(
          list.map((p: { id: string }) =>
            fetch(`/api/v1/projects/${p.id}`, { credentials: 'include' })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        const enriched: CalendarProject[] = details
          .filter(Boolean)
          .map((p: { id: string; title: string; milestones: CalendarMilestone[] }) => ({
            id: p.id,
            title: p.title,
            milestones: p.milestones || [],
          }));
        setProjects(enriched);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchEvents = React.useCallback(async () => {
    setIsLoading(true);
    const { from, to } = computeRange(view, currentDate);
    const params = new URLSearchParams();
    params.set('from', toISODate(from));
    params.set('to', toISODate(to));
    if (view !== 'month') params.set('include_routine', 'true');
    const res = await fetch(`/api/v1/calendar/events?${params}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events || []);
      setRoutineBlocks(data.routine_projections || []);
    } else {
      setEvents([]);
      setRoutineBlocks([]);
    }
    setIsLoading(false);
  }, [view, currentDate]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = React.useMemo(() => {
    return events.filter((e) => {
      const key: EventType | 'system' = e.is_system ? 'system' : e.event_type;
      const typeKey: EventType | 'system' = e.is_system ? e.event_type : key;
      if (!typeFilters.has(typeKey)) return false;

      if (e.child_ids.length === 0) {
        return includeFamilyEvents;
      }
      if (selectedChildIds.size === 0) return true;
      return e.child_ids.some((id) => selectedChildIds.has(id));
    });
  }, [events, typeFilters, selectedChildIds, includeFamilyEvents]);

  const daysWithEvents = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of filteredEvents) {
      const start = parseServerDate(e.start_at);
      set.add(`${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`);
    }
    return set;
  }, [filteredEvents]);

  function toggleChild(id: string) {
    setSelectedChildIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleType(type: EventType | 'system') {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function navigate(delta: number) {
    if (view === 'month') setCurrentDate((d) => addMonths(d, delta));
    else if (view === 'week') setCurrentDate((d) => addDays(d, delta * 7));
    else setCurrentDate((d) => addDays(d, delta));
  }

  function handleEventClick(event: CalendarEvent) {
    setSelectedEvent(event);
  }

  function handleSlotClick(date: Date, hour: number) {
    setCreateDefaults({ date, hour });
    setIsCreating(true);
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date);
    if (view === 'month') changeView('day');
  }

  function openCreate() {
    setCreateDefaults({ date: currentDate });
    setIsCreating(true);
  }

  function handleEditClick() {
    if (selectedEvent && !selectedEvent.is_system) {
      setEditingEvent(selectedEvent);
      setSelectedEvent(null);
    }
  }

  async function handleDeleteFromDetail() {
    if (!selectedEvent || selectedEvent.is_system) return;
    const res = await fetch(`/api/v1/calendar/events/${selectedEvent.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setSelectedEvent(null);
      fetchEvents();
    }
  }

  function handleNavigateSource(url: string) {
    router.push(url as any);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingEvent(null);
  }

  function onSaved() {
    closeForm();
    fetchEvents();
  }

  function onDeleted() {
    closeForm();
    fetchEvents();
  }

  const headerLabel = React.useMemo(() => {
    if (view === 'month') {
      return `${t(MONTH_KEYS[currentDate.getMonth()])} ${currentDate.getFullYear()}`;
    }
    if (view === 'week') {
      const days = buildWeekDays(currentDate);
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${t(MONTH_KEYS[first.getMonth()])} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
      }
      return `${t(MONTH_KEYS[first.getMonth()])} ${first.getDate()} – ${t(MONTH_KEYS[last.getMonth()])} ${last.getDate()}, ${last.getFullYear()}`;
    }
    return `${t(MONTH_KEYS[currentDate.getMonth()])} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  }, [view, currentDate, t]);

  return (
    <div className="flex flex-col h-full -m-6 lg:-m-8">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {t('addEvent')}
        </Button>
      </div>

      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {t('today')}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-100"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-100"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-slate-800 ml-2">{headerLabel}</h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          daysWithEvents={daysWithEvents}
          childrenList={children}
          selectedChildIds={selectedChildIds}
          includeFamilyEvents={includeFamilyEvents}
          onToggleChild={toggleChild}
          onToggleFamily={() => setIncludeFamilyEvents((v) => !v)}
          typeFilters={typeFilters}
          onToggleType={toggleType}
        />

        <div className="flex-1 overflow-hidden bg-white relative">
          {isLoading && (
            <div className="absolute top-4 right-4 z-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={filteredEvents}
              routineBlocks={routineBlocks}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              showRoutine
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={filteredEvents}
              routineBlocks={routineBlocks}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              showRoutine
            />
          )}
          {!isLoading && filteredEvents.length === 0 && view === 'month' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-slate-400 pointer-events-none">
              {t('noEventsFiltered')}
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          childrenList={children}
          subjects={subjects}
          projects={projects}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEditClick}
          onDelete={handleDeleteFromDetail}
          onNavigateSource={handleNavigateSource}
        />
      )}

      {(isCreating || editingEvent) && (
        <EventFormDrawer
          event={editingEvent}
          defaultDate={createDefaults.date}
          defaultHour={createDefaults.hour}
          childrenList={children}
          subjects={subjects}
          projects={projects}
          onClose={closeForm}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
