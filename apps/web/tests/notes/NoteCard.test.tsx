import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { NoteCard } from '../../components/notes/NoteCard';
import type { Note } from '../../components/notes/types';

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  family_id: 'f1',
  author_user_id: 'u1',
  author_name: 'Alice',
  title: 'My Note',
  content: 'This is the body of the note.',
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

describe('NoteCard', () => {
  let onEdit: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;
  let onTogglePin: ReturnType<typeof vi.fn>;
  let onChangeStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onEdit = vi.fn();
    onDelete = vi.fn();
    onTogglePin = vi.fn();
    onChangeStatus = vi.fn();
  });

  function render(note: Note) {
    return renderWithProviders(
      <NoteCard
        note={note}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
        onChangeStatus={onChangeStatus}
      />,
    );
  }

  it('renders the note title and content excerpt', () => {
    render(makeNote());
    expect(screen.getByText('My Note')).toBeInTheDocument();
    expect(screen.getByText(/This is the body/)).toBeInTheDocument();
  });

  it('falls back to content excerpt when title is null', () => {
    render(makeNote({ title: null, content: 'Just plain content' }));
    expect(screen.getByText('Just plain content')).toBeInTheDocument();
  });

  it('truncates very long content with ellipsis', () => {
    const longContent = 'X'.repeat(300);
    render(makeNote({ title: null, content: longContent }));
    // Find a span/h3 that contains an ellipsis
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it('shows author name when present', () => {
    render(makeNote({ author_name: 'Alice' }));
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('shows tags with # prefix', () => {
    render(makeNote({ tags: ['urgent', 'school'] }));
    expect(screen.getByText('#urgent')).toBeInTheDocument();
    expect(screen.getByText('#school')).toBeInTheDocument();
  });

  it('shows entity label when entity_type and entity_label are set', () => {
    render(makeNote({ entity_type: 'subject', entity_label: 'Mathematics' }));
    expect(screen.getByText(/Mathematics/)).toBeInTheDocument();
  });

  it('toggles pin via the pin button', async () => {
    render(makeNote());
    const pinButton = screen.getByTitle(/pin/i);
    await userEvent.click(pinButton);
    expect(onTogglePin).toHaveBeenCalledOnce();
  });

  it('renders filled pin icon when is_pinned is true', () => {
    const { container } = render(makeNote({ is_pinned: true }));
    expect(container.querySelector('.fill-amber-400')).not.toBeNull();
  });

  it('opens edit handler when edit button is clicked', async () => {
    render(makeNote());
    const editButton = screen.getByTitle(/edit/i);
    await userEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('shows delete confirmation when delete is clicked', async () => {
    render(makeNote());
    const deleteButton = screen.getByTitle(/delete/i);
    await userEvent.click(deleteButton);
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete only after confirmation', async () => {
    render(makeNote());
    await userEvent.click(screen.getByTitle(/delete/i));
    // Click confirm button (red one, not "cancel")
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find((b) => b.className.includes('bg-red-600'));
    await userEvent.click(confirmBtn!);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('cancelling the delete dialog does not call onDelete', async () => {
    render(makeNote());
    await userEvent.click(screen.getByTitle(/delete/i));
    await userEvent.click(screen.getByText(/cancel/i));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('marks note as overdue with red styling for past due_date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isoYesterday = yesterday.toISOString().split('T')[0];

    const { container } = render(makeNote({ status: 'todo', due_date: isoYesterday }));
    expect(container.querySelector('.text-red-500')).not.toBeNull();
  });

  it('does not show overdue style for completed notes even with past due date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isoYesterday = yesterday.toISOString().split('T')[0];

    const { container } = render(makeNote({ status: 'completed', due_date: isoYesterday }));
    // The due date span should still appear, just not in red
    const redOverdue = container.querySelector('.text-red-500.font-medium');
    expect(redOverdue).toBeNull();
  });
});
