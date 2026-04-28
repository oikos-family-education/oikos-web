import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { StatusBadge, statusLabelKey } from '../../components/notes/StatusBadge';
import type { NoteStatus } from '../../components/notes/types';

describe('StatusBadge', () => {
  const STATUSES: NoteStatus[] = [
    'draft', 'todo', 'in_progress', 'to_remember', 'completed', 'archived', 'history_only',
  ];

  it.each(STATUSES)('renders without crashing for status=%s', (status) => {
    renderWithProviders(<StatusBadge status={status} />);
    // Translation key resolves to actual text from the messages file
    // For each status there is some visible badge text.
    const badge = document.querySelector('span.inline-flex');
    expect(badge).not.toBeNull();
  });

  it('applies the corresponding background color class', () => {
    renderWithProviders(<StatusBadge status="todo" />);
    const badge = screen.getByText(/^todo$/i);
    expect(badge.className).toContain('bg-blue-100');
  });

  it('applies completed-status color', () => {
    renderWithProviders(<StatusBadge status="completed" />);
    const badge = document.querySelector('span.bg-green-100');
    expect(badge).not.toBeNull();
  });

  it('appends the custom className', () => {
    renderWithProviders(<StatusBadge status="todo" className="my-custom" />);
    const badge = document.querySelector('span.my-custom');
    expect(badge).not.toBeNull();
  });
});

describe('statusLabelKey', () => {
  it('maps each status to its translation key', () => {
    expect(statusLabelKey('draft')).toBe('statusDraft');
    expect(statusLabelKey('todo')).toBe('statusTodo');
    expect(statusLabelKey('in_progress')).toBe('statusInProgress');
    expect(statusLabelKey('to_remember')).toBe('statusToRemember');
    expect(statusLabelKey('completed')).toBe('statusCompleted');
    expect(statusLabelKey('archived')).toBe('statusArchived');
    expect(statusLabelKey('history_only')).toBe('statusHistoryOnly');
  });
});
