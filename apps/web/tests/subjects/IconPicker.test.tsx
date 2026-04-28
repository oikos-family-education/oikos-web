import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker } from '../../components/subjects/IconPicker';

describe('IconPicker', () => {
  it('renders the trigger button', () => {
    render(<IconPicker value={null} onChange={() => {}} color="#000" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens the picker dropdown on click', async () => {
    render(<IconPicker value={null} onChange={() => {}} color="#000" />);
    await userEvent.click(screen.getByRole('button'));
    // Search box appears in dropdown
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('filters icons by search query', async () => {
    render(<IconPicker value={null} onChange={() => {}} color="#000" />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByRole('textbox'), 'book');
    // Many "Book" icons should show; count buttons (each icon is a button)
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(1);
  });

  it('calls onChange and closes when an icon is selected', async () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} color="#000" />);
    await userEvent.click(screen.getByRole('button'));

    // Click first icon button (after the trigger button)
    const allButtons = screen.getAllByRole('button');
    // The first button is the trigger; pick another one
    const iconButton = allButtons[1];
    await userEvent.click(iconButton);

    expect(onChange).toHaveBeenCalledOnce();
    // Dropdown closes (textbox no longer in dom)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', async () => {
    render(
      <div>
        <IconPicker value={null} onChange={() => {}} color="#000" />
        <button>Outside</button>
      </div>,
    );
    // Open the picker (trigger is the first button)
    const triggers = screen.getAllByRole('button');
    await userEvent.click(triggers[0]);
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    // Click outside (mousedown is what the component listens for)
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
