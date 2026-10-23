import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { PlannerDayView } from '../../components/planner/PlannerDayView';
import type { ChildData, GridConfig, RoutineEntryData, SubjectData } from '../../components/planner/types';

const config: GridConfig = { start_hour: 8, end_hour: 16, include_saturday: false, include_sunday: false };

const children: ChildData[] = [
  { id: 'c1', name: 'Alice', first_name: 'Alice', nickname: 'Ali', birthdate: null, birth_year: null, birth_month: null, grade_level: null, is_active: true },
  { id: 'c2', name: 'Bob', first_name: 'Bob', nickname: null, birthdate: null, birth_year: null, birth_month: null, grade_level: null, is_active: true },
];

const subjects: SubjectData[] = [
  {
    id: 's1', name: 'Mathematics', short_description: 'Numbers and shapes', icon: 'Calculator',
    color: '#4f46e5', priority: 1, default_session_duration_minutes: 45, responsible_member_id: 'p2',
  },
];

function entry(id: string, overrides: Partial<RoutineEntryData>): RoutineEntryData {
  return {
    id, template_id: 't', family_id: 'f', subject_id: null, is_free_time: false, child_ids: [],
    day_of_week: 0, start_minute: 540, duration_minutes: 45, priority: 'medium', color: null,
    notes: null, created_at: '', updated_at: '', ...overrides,
  };
}

const entries: RoutineEntryData[] = [
  entry('e1', { subject_id: 's1', child_ids: ['c1', 'c2'], notes: 'Bring the abacus', priority: 'high' }),
  entry('e2', { child_ids: ['c2'], start_minute: 600, duration_minutes: 90, notes: '🎨\nPottery class\nAt the studio' }),
  entry('e3', { subject_id: 's1', child_ids: ['c1'], day_of_week: 1 }),
];

function renderDay(dayIndex = 0, onDayChange = vi.fn()) {
  renderWithProviders(
    <PlannerDayView
      entries={entries}
      subjects={subjects}
      childrenList={children}
      config={config}
      dayIndex={dayIndex}
      onDayChange={onDayChange}
      parentsById={{
        p2: { id: 'p2', first_name: 'Pedro', last_name: null, email: null, has_account: false, role: 'co_parent' },
      }}
      resourcesBySubject={{
        s1: [{ id: 'r1', title: 'Singapore Math 3A', type: 'book', progress_notes: 'Chapter 4' }],
      }}
    />,
  );
  return onDayChange;
}

describe('PlannerDayView', () => {
  it('shows a column per child using their display name', () => {
    renderDay();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining([expect.stringContaining('Ali'), expect.stringContaining('Bob')]));
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeInTheDocument();
  });

  it('shows subject details: teacher, resources, notes and shared children', () => {
    renderDay();
    // Shared entry is shown in both children's columns
    expect(screen.getAllByText('Mathematics')).toHaveLength(2);
    expect(screen.getAllByText('Taught by Pedro')).toHaveLength(2);
    expect(screen.getAllByText('Singapore Math 3A')).toHaveLength(2);
    expect(screen.getAllByText(/Chapter 4/)).toHaveLength(2);
    expect(screen.getAllByText('Bring the abacus')).toHaveLength(2);
    expect(screen.getByText('Together with Bob')).toBeInTheDocument();
    expect(screen.getByText('Together with Ali')).toBeInTheDocument();
    expect(screen.getAllByText(/09:00–09:45/)).toHaveLength(2);
  });

  it('shows custom activities with their own icon, name and notes', () => {
    renderDay();
    const card = screen.getByText('Pottery class').closest('article')!;
    expect(within(card).getByText('🎨')).toBeInTheDocument();
    expect(within(card).getByText('At the studio')).toBeInTheDocument();
    expect(within(card).getByText(/10:00–11:30/)).toBeInTheDocument();
  });

  it('only shows the selected day', () => {
    renderDay(1);
    expect(screen.getByRole('heading', { name: 'Tuesday' })).toBeInTheDocument();
    expect(screen.getAllByText('Mathematics')).toHaveLength(1);
    expect(screen.queryByText('Pottery class')).not.toBeInTheDocument();
  });

  it('navigates between visible days, wrapping around the week', () => {
    const onDayChange = renderDay(4);
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(onDayChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(onDayChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole('tab', { name: 'Wed' }));
    expect(onDayChange).toHaveBeenLastCalledWith(2);
  });

  it('shows an empty state for a day with nothing planned', () => {
    renderDay(3);
    expect(screen.getByText('Nothing planned for Thursday.')).toBeInTheDocument();
  });
});
