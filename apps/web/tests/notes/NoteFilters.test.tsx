import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { NoteFilters, type FiltersState } from '../../components/notes/NoteFilters';

const baseFilters: FiltersState = {
  q: '',
  statuses: [],
  entityType: null,
  pinned: false,
  overdue: false,
  tag: null,
};

describe('NoteFilters', () => {
  it('renders the search input', () => {
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={() => {}} allTags={[]} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('emits filter change when search text is typed', async () => {
    const onChange = vi.fn();
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={onChange} allTags={[]} />);
    await userEvent.type(screen.getByRole('textbox'), 'foo');
    // Each keystroke triggers a change call
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].q).toBe('f');
  });

  it('toggles a status checkbox', async () => {
    const onChange = vi.fn();
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={onChange} allTags={[]} />);
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].statuses.length).toBe(1);
  });

  it('removes a status when toggled off', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <NoteFilters
        filters={{ ...baseFilters, statuses: ['todo'] }}
        onChange={onChange}
        allTags={[]}
      />,
    );
    // First "todo" status checkbox — translation renders "Todo" (no space)
    const todoCheckbox = screen.getByLabelText(/^todo$/i);
    expect(todoCheckbox).toBeChecked();
    await userEvent.click(todoCheckbox);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].statuses).toEqual([]);
  });

  it('changes entity radio to general', async () => {
    const onChange = vi.fn();
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={onChange} allTags={[]} />);
    const radios = screen.getAllByRole('radio');
    // Index 0 = "All", 1 = "general"
    await userEvent.click(radios[1]);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].entityType).toBe('general');
  });

  it('toggles pinned checkbox', async () => {
    const onChange = vi.fn();
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={onChange} allTags={[]} />);
    const pinned = screen.getByLabelText(/pinned/i);
    await userEvent.click(pinned);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].pinned).toBe(true);
  });

  it('toggles overdue checkbox', async () => {
    const onChange = vi.fn();
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={onChange} allTags={[]} />);
    const overdue = screen.getByLabelText(/overdue/i);
    await userEvent.click(overdue);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].overdue).toBe(true);
  });

  it('shows tag chips when allTags is non-empty', () => {
    renderWithProviders(
      <NoteFilters filters={baseFilters} onChange={() => {}} allTags={['urgent', 'school']} />,
    );
    expect(screen.getByText('#urgent')).toBeInTheDocument();
    expect(screen.getByText('#school')).toBeInTheDocument();
  });

  it('selecting a tag chip emits onChange with that tag', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <NoteFilters filters={baseFilters} onChange={onChange} allTags={['urgent']} />,
    );
    await userEvent.click(screen.getByText('#urgent'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tag: 'urgent' }));
  });

  it('clicking selected tag chip un-selects it', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <NoteFilters
        filters={{ ...baseFilters, tag: 'urgent' }}
        onChange={onChange}
        allTags={['urgent']}
      />,
    );
    await userEvent.click(screen.getByText('#urgent'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tag: null }));
  });

  it('shows clear filters button when any filter is active', () => {
    renderWithProviders(
      <NoteFilters filters={{ ...baseFilters, pinned: true }} onChange={() => {}} allTags={[]} />,
    );
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('does not show clear button when all filters are inactive', () => {
    renderWithProviders(<NoteFilters filters={baseFilters} onChange={() => {}} allTags={[]} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('clear button resets all filters', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <NoteFilters
        filters={{ ...baseFilters, q: 'x', pinned: true, overdue: true, tag: 't' }}
        onChange={onChange}
        allTags={['t']}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({
      q: '',
      statuses: [],
      entityType: null,
      pinned: false,
      overdue: false,
      tag: null,
    });
  });
});
