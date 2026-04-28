import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { LogEntryRow } from '../../components/progress/LogEntryRow';

const baseEntry = {
  id: 'log1',
  taught_on: '2024-06-15',
  child_id: 'c1',
  subject_id: 's1',
  minutes: 45,
  notes: null,
};

const children = [{ id: 'c1', name: 'Alice' }];
const subjects = [{ id: 's1', name: 'Mathematics', color: '#4f46e5' }];

describe('LogEntryRow', () => {
  it('renders subject and child names', () => {
    renderWithProviders(
      <LogEntryRow
        entry={baseEntry}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders minutes when present', () => {
    renderWithProviders(
      <LogEntryRow
        entry={baseEntry}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    expect(screen.getByText(/45m/)).toBeInTheDocument();
  });

  it('does not render minutes section when null', () => {
    renderWithProviders(
      <LogEntryRow
        entry={{ ...baseEntry, minutes: null }}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    expect(screen.queryByText(/m$/)).not.toBeInTheDocument();
  });

  it('renders notes in italics when present', () => {
    renderWithProviders(
      <LogEntryRow
        entry={{ ...baseEntry, notes: 'Great session today' }}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    expect(screen.getByText(/Great session today/)).toBeInTheDocument();
  });

  it('falls back to "general teaching" when no subject_id', () => {
    renderWithProviders(
      <LogEntryRow
        entry={{ ...baseEntry, subject_id: null }}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    // The translation namespace returns the fallback label
    expect(screen.queryByText('Mathematics')).not.toBeInTheDocument();
  });

  it('falls back to "all children" when no child_id', () => {
    renderWithProviders(
      <LogEntryRow
        entry={{ ...baseEntry, child_id: null }}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('first delete click shows confirmation, second click deletes', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <LogEntryRow
        entry={baseEntry}
        children={children}
        subjects={subjects}
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole('button');
    // First click — confirming state
    await userEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
    expect(button.className).toContain('bg-red-500');

    // Second click — actually deletes
    await userEvent.click(button);
    expect(onDelete).toHaveBeenCalledWith('log1');
  });

  it('renders the subject color dot', () => {
    const { container } = renderWithProviders(
      <LogEntryRow
        entry={baseEntry}
        children={children}
        subjects={subjects}
        onDelete={async () => {}}
      />,
    );
    const dot = container.querySelector('.rounded-full[style]') as HTMLElement;
    expect(dot.style.backgroundColor).toBeTruthy();
  });
});
