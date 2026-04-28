import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { NoteTimeline } from '../../components/notes/NoteTimeline';
import type { Note } from '../../components/notes/types';

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  family_id: 'f1',
  author_user_id: null,
  author_name: null,
  title: 'Note',
  content: 'Content',
  status: 'todo',
  entity_type: null,
  entity_id: null,
  entity_label: null,
  tags: [],
  is_pinned: false,
  due_date: null,
  created_at: '2024-06-15T10:00:00Z',
  updated_at: '2024-06-15T10:00:00Z',
  ...overrides,
});

describe('NoteTimeline', () => {
  it('renders empty list when no notes', () => {
    const { container } = renderWithProviders(
      <NoteTimeline
        notes={[]}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onChangeStatus={() => {}}
      />,
    );
    // The container div is empty (only the wrapping space-y-6 div)
    expect(container.querySelectorAll('h3').length).toBe(0);
  });

  it('renders all notes', () => {
    renderWithProviders(
      <NoteTimeline
        notes={[
          makeNote({ id: 'n1', title: 'Note A' }),
          makeNote({ id: 'n2', title: 'Note B' }),
        ]}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onChangeStatus={() => {}}
      />,
    );
    expect(screen.getByText('Note A')).toBeInTheDocument();
    expect(screen.getByText('Note B')).toBeInTheDocument();
  });

  it('groups notes by date and renders one heading per day', () => {
    const { container } = renderWithProviders(
      <NoteTimeline
        notes={[
          makeNote({ id: 'n1', title: 'Day A1', created_at: '2024-06-15T10:00:00Z' }),
          makeNote({ id: 'n2', title: 'Day A2', created_at: '2024-06-15T15:00:00Z' }),
          makeNote({ id: 'n3', title: 'Day B', created_at: '2024-06-16T10:00:00Z' }),
        ]}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onChangeStatus={() => {}}
      />,
    );
    // The timeline date group heading uses a specific class — count just those.
    const dateHeadings = container.querySelectorAll('h3.text-sm.font-semibold.text-slate-500');
    expect(dateHeadings.length).toBe(2);
  });

  it('sorts notes in descending chronological order across the timeline', () => {
    const { container } = renderWithProviders(
      <NoteTimeline
        notes={[
          makeNote({ id: 'n-old', title: 'Old', created_at: '2024-06-01T10:00:00Z' }),
          makeNote({ id: 'n-new', title: 'New', created_at: '2024-06-30T10:00:00Z' }),
        ]}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePin={() => {}}
        onChangeStatus={() => {}}
      />,
    );
    // Filter to just timeline date headings (not the per-note titles)
    const dateHeadings = container.querySelectorAll('h3.text-sm.font-semibold.text-slate-500');
    expect(dateHeadings[0].textContent).toContain('30');
    expect(dateHeadings[1].textContent).toMatch(/\b1\b/);
  });
});
