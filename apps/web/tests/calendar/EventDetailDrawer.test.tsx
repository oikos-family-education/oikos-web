import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { EventDetailDrawer } from '../../components/calendar/EventDetailDrawer';
import type {
  CalendarEvent,
  CalendarChild,
  CalendarSubject,
  CalendarProject,
} from '../../components/calendar/types';

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  family_id: 'f1',
  title: 'Doctor Appointment',
  description: null,
  event_type: 'family',
  all_day: false,
  start_at: '2024-06-15T14:00:00Z',
  end_at: '2024-06-15T15:00:00Z',
  child_ids: [],
  subject_id: null,
  project_id: null,
  milestone_id: null,
  color: null,
  location: null,
  recurrence: 'none',
  is_system: false,
  source_url: null,
  ...overrides,
});

const childList: CalendarChild[] = [
  { id: 'c1', first_name: 'Alice', nickname: null, avatar_initials: 'A' },
  { id: 'c2', first_name: 'Bob', nickname: 'Bobby', avatar_initials: 'B' },
];
const subjects: CalendarSubject[] = [
  { id: 's1', name: 'Mathematics', color: '#4f46e5' },
];
const projects: CalendarProject[] = [
  { id: 'p1', title: 'Science Project', milestones: [{ id: 'm1', project_id: 'p1', title: 'Research', due_date: null }] },
];

describe('EventDetailDrawer', () => {
  it('renders the event title', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent()}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Doctor Appointment' })).toBeInTheDocument();
  });

  it('renders the event description when present', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ description: 'Annual check-up' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Annual check-up')).toBeInTheDocument();
  });

  it('renders the event location when set', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ location: '123 Main St' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('renders assigned children using nickname or first_name', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ child_ids: ['c1', 'c2'] })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bobby')).toBeInTheDocument();
  });

  it('shows linked subject details when subject_id is set', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ subject_id: 's1' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
  });

  it('shows linked project details when project_id is set', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ project_id: 'p1' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Science Project')).toBeInTheDocument();
  });

  it('shows milestone title when milestone_id is set', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ project_id: 'p1', milestone_id: 'm1' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/Research/)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent()}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={onClose}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    // First button in the drawer is the X close button
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <EventDetailDrawer
        event={baseEvent()}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={onClose}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const backdrop = container.querySelector('.bg-black\\/30');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows recurrence label only when recurrence != none', () => {
    renderWithProviders(
      <EventDetailDrawer
        event={baseEvent({ recurrence: 'weekly' })}
        childrenList={childList}
        subjects={subjects}
        projects={projects}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    // Translation namespace will produce some "Weekly" label
    const recurrenceLabel = document.querySelector('.text-slate-500.mt-1');
    expect(recurrenceLabel).not.toBeNull();
  });
});
