'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from './Modal';
import { Loader2 } from 'lucide-react';

interface QuickEventModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

function todayLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextHourTime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function plusHourTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function QuickEventModal({ open, onClose, onCreated }: QuickEventModalProps) {
  const t = useTranslations('Dashboard');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayLocalISODate());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState(nextHourTime());
  const [endTime, setEndTime] = useState(plusHourTime(nextHourTime()));
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(todayLocalISODate());
      setAllDay(false);
      const start = nextHourTime();
      setStartTime(start);
      setEndTime(plusHourTime(start));
      setLocation('');
      setError(null);
    }
  }, [open]);

  // Keep end time at least one hour after start time when start changes.
  useEffect(() => {
    if (allDay) return;
    if (endTime <= startTime) {
      setEndTime(plusHourTime(startTime));
    }
  }, [startTime, allDay, endTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const startAt = allDay
        ? new Date(`${date}T00:00:00`)
        : new Date(`${date}T${startTime}:00`);
      const endAt = allDay
        ? new Date(`${date}T23:59:59`)
        : new Date(`${date}T${endTime}:00`);

      const body = {
        title: title.trim(),
        event_type: 'family',
        all_day: allDay,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        location: location.trim() || null,
        recurrence: 'none',
      };

      const res = await fetch('/api/v1/calendar/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.detail === 'string' ? data.detail : 'Could not create event.');
        return;
      }

      onCreated?.();
      onClose();
    } catch {
      setError('Could not create event.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('quickAddEvent')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="quick-event-title" className="block text-sm font-semibold text-slate-700 mb-1">
            Title
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="quick-event-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={255}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Field trip to the museum"
          />
        </div>

        <div>
          <label htmlFor="quick-event-date" className="block text-sm font-semibold text-slate-700 mb-1">
            Date
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="quick-event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="rounded border-slate-300 text-primary focus:ring-primary"
          />
          All day
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-event-start" className="block text-sm font-semibold text-slate-700 mb-1">
                Start
              </label>
              <input
                id="quick-event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="quick-event-end" className="block text-sm font-semibold text-slate-700 mb-1">
                End
              </label>
              <input
                id="quick-event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="quick-event-location" className="block text-sm font-semibold text-slate-700 mb-1">
            Location <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="quick-event-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={255}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Park, library, home…"
          />
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary-hover disabled:bg-indigo-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save event
          </button>
        </div>
      </form>
    </Modal>
  );
}
