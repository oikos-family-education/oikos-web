import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { NoteBoard } from '../../components/notes/NoteBoard';
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

describe('NoteBoard', () => {
  it('renders 4 board columns (one per BOARD_STATUSES entry)', () => {
    const { container } = renderWithProviders(
      <NoteBoard notes={[]} onEdit={() => {}} onMove={() => {}} />,
    );
    // Each column has bg-slate-50 rounded-xl
    const columns = container.querySelectorAll('.bg-slate-50.rounded-xl');
    expect(columns.length).toBe(4);
  });

  it('shows note count per column', () => {
    renderWithProviders(
      <NoteBoard
        notes={[
          makeNote({ id: 'n1', status: 'todo' }),
          makeNote({ id: 'n2', status: 'todo' }),
          makeNote({ id: 'n3', status: 'completed' }),
        ]}
        onEdit={() => {}}
        onMove={() => {}}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument(); // todo count
    expect(screen.getByText('1')).toBeInTheDocument(); // completed count
  });

  it('shows column-empty placeholder for empty columns', () => {
    renderWithProviders(<NoteBoard notes={[]} onEdit={() => {}} onMove={() => {}} />);
    // 4 columns, all empty → 4 placeholder messages (or at least one visible per column)
    expect(screen.getAllByText(/empty/i).length).toBeGreaterThanOrEqual(4);
  });

  it('renders note titles in their respective columns', () => {
    renderWithProviders(
      <NoteBoard
        notes={[makeNote({ title: 'My Task', status: 'todo' })]}
        onEdit={() => {}}
        onMove={() => {}}
      />,
    );
    expect(screen.getByText('My Task')).toBeInTheDocument();
  });

  it('renders content excerpt when title is missing', () => {
    renderWithProviders(
      <NoteBoard
        notes={[makeNote({ title: null, content: 'Just content here', status: 'todo' })]}
        onEdit={() => {}}
        onMove={() => {}}
      />,
    );
    expect(screen.getByText(/just content here/i)).toBeInTheDocument();
  });

  it('shows tags up to 3', () => {
    renderWithProviders(
      <NoteBoard
        notes={[makeNote({ status: 'todo', tags: ['a', 'b', 'c', 'd'] })]}
        onEdit={() => {}}
        onMove={() => {}}
      />,
    );
    expect(screen.getByText('#a')).toBeInTheDocument();
    expect(screen.getByText('#b')).toBeInTheDocument();
    expect(screen.getByText('#c')).toBeInTheDocument();
    expect(screen.queryByText('#d')).not.toBeInTheDocument();
  });

  it('calls onEdit on double-click', () => {
    const onEdit = vi.fn();
    renderWithProviders(
      <NoteBoard
        notes={[makeNote({ title: 'Edit me', status: 'todo' })]}
        onEdit={onEdit}
        onMove={() => {}}
      />,
    );
    fireEvent.doubleClick(screen.getByText('Edit me'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('renders entity label when present', () => {
    renderWithProviders(
      <NoteBoard
        notes={[makeNote({ status: 'todo', entity_label: 'Math class' })]}
        onEdit={() => {}}
        onMove={() => {}}
      />,
    );
    expect(screen.getByText('Math class')).toBeInTheDocument();
  });
});
