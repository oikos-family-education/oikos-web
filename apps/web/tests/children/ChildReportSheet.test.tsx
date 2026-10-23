import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ChildReportSheet } from '../../components/children/report/ChildReportSheet';
import { ChildReport, DEFAULT_SECTIONS, REPORT_SECTIONS, ReportSection } from '../../components/children/report/types';

const report: ChildReport = {
  generated_at: '2026-10-22T10:00:00Z',
  range: { from_date: '2026-01-01', to_date: '2026-12-31' },
  family: { family_name: 'Silva', shield_config: null },
  child: {
    id: 'c1', first_name: 'Alice', nickname: 'Ali', birthdate: null, birth_year: null, birth_month: null,
    grade_level: 'grade_3', learning_styles: ['visual'], interests: ['birds'], personality_description: null,
    personality_tags: [], motivators: null, learning_differences: ['dyslexia'], accommodations_notes: 'Extra time',
  },
  curriculums: [{
    id: 'cur1', name: 'Year 3', description: null, period_type: 'annual', start_date: '2026-01-01',
    end_date: '2026-12-31', education_philosophy: 'Charlotte Mason', overall_goals: ['Read fluently'],
    subjects: [{
      id: 's1', name: 'Mathematics', color: '#4f46e5', icon: 'Calculator', category: 'core_academic',
      short_description: 'Numbers and shapes', learning_objectives: ['Multiply'], skills_targeted: ['Logic'],
      weekly_frequency: 4, session_duration_minutes: 45, scheduled_days: [0, 2], goals_for_period: ['Times tables'],
      notes: null, taught_by: 'Pedro',
      resources: [{ id: 'r1', title: 'Singapore Math 3A', type: 'book', author: 'Marshall', progress_notes: 'Chapter 4' }],
      sessions_logged: 12, minutes_logged: 540,
    }],
  }],
  projects: [{
    id: 'p1', title: 'Bird study', description: null, purpose: null, status: 'complete', due_date: null,
    completed_at: '2026-04-01T12:00:00Z', subject_names: ['Science'], milestones_total: 3, milestones_completed: 2,
    portfolio: { title: 'My bird book', reflection: 'I loved owls', parent_notes: null, score: 9 },
  }],
  routine: {
    template_name: 'Term 1', include_saturday: false, include_sunday: false,
    entries: [{ day_of_week: 0, start_minute: 540, duration_minutes: 45, subject_id: 's1', subject_name: 'Mathematics', icon: null, color: '#4f46e5', is_free_time: false, notes: null }],
  },
  notes: [{ id: 'n1', title: null, content: 'Loves fractions', tags: [], is_pinned: false, created_at: '2026-02-01T00:00:00Z' }],
  highlights: [
    { id: 'h1', child_id: 'c1', category: 'book', title: 'The Hobbit', description: 'Read aloud', occurred_on: '2026-03-10', created_at: '', updated_at: '' },
    { id: 'h2', child_id: 'c1', category: 'outdoor', title: 'Lake hike', description: null, occurred_on: '2026-05-02', created_at: '', updated_at: '' },
  ],
  learning_summary: { total_sessions: 12, total_minutes: 540, days_with_sessions: 10 },
};

function renderSheet(sections: ReportSection[] = DEFAULT_SECTIONS) {
  renderWithProviders(<ChildReportSheet report={report} sections={new Set(sections)} dateFormat="YYYY-MM-DD" />);
}

describe('ChildReportSheet', () => {
  it('renders the title, period and child profile', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: "Ali's Learning Report" })).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 — 2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('Alice (Ali)')).toBeInTheDocument();
    expect(screen.getByText('Grade 3')).toBeInTheDocument();
    expect(screen.getByText('Visual')).toBeInTheDocument();
  });

  it('shows curriculum subjects with teacher, resources and goals', () => {
    renderSheet();
    expect(screen.getByText('Year 3')).toBeInTheDocument();
    expect(screen.getByText('Taught by Pedro')).toBeInTheDocument();
    expect(screen.getByText('Singapore Math 3A')).toBeInTheDocument();
    expect(screen.getByText(/Chapter 4/)).toBeInTheDocument();
    expect(screen.getByText('Times tables')).toBeInTheDocument();
    expect(screen.getByText(/4 sessions a week · 45 min each/)).toBeInTheDocument();
    expect(screen.getByText('12 lessons logged · 9 h')).toBeInTheDocument();
  });

  it('shows projects, routine, highlights grouped by type, and notes', () => {
    renderSheet();
    expect(screen.getByText('Bird study')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 milestones completed')).toBeInTheDocument();
    expect(screen.getByText(/score 9\/10/)).toBeInTheDocument();
    expect(screen.getByText('Term 1')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Monday' })).toBeInTheDocument();
    expect(screen.getByText('Books read')).toBeInTheDocument();
    expect(screen.getByText('The Hobbit')).toBeInTheDocument();
    expect(screen.getByText('Outdoor activities')).toBeInTheDocument();
    expect(screen.getByText('Loves fractions')).toBeInTheDocument();
  });

  it('leaves learning needs out by default and never shows streaks', () => {
    renderSheet();
    expect(screen.queryByText('dyslexia')).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('includes learning needs when that section is ticked', () => {
    renderSheet(REPORT_SECTIONS);
    expect(screen.getByText('dyslexia')).toBeInTheDocument();
    expect(screen.getByText('Extra time')).toBeInTheDocument();
  });

  it('omits sections that are unticked', () => {
    renderSheet(['profile']);
    expect(screen.queryByText('Year 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Bird study')).not.toBeInTheDocument();
    expect(screen.queryByText('The Hobbit')).not.toBeInTheDocument();
    expect(screen.queryByText('Loves fractions')).not.toBeInTheDocument();
  });
});
