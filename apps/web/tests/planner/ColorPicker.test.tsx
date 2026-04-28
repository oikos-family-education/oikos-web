import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from '../../components/planner/ColorPicker';

describe('ColorPicker', () => {
  it('renders trigger button with selected color', () => {
    const { container } = render(<ColorPicker selected="#ff0000" onSelect={() => {}} />);
    const swatch = container.querySelector('span.rounded-full') as HTMLElement;
    expect(swatch).not.toBeNull();
    expect(swatch.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('opens picker on click', async () => {
    const { container } = render(<ColorPicker selected="#ff0000" onSelect={() => {}} />);
    await userEvent.click(container.querySelector('button')!);
    // Popover renders preset color buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(1);
  });

  it('calls onSelect when a color is chosen', async () => {
    const onSelect = vi.fn();
    const { container } = render(<ColorPicker selected="#ff0000" onSelect={onSelect} />);
    await userEvent.click(container.querySelector('button')!);
    const allButtons = container.querySelectorAll('button');
    // Click the second button (first preset color)
    await userEvent.click(allButtons[1]);
    expect(onSelect).toHaveBeenCalled();
  });

  it('closes when Escape is pressed', async () => {
    const { container } = render(<ColorPicker selected="#ff0000" onSelect={() => {}} />);
    await userEvent.click(container.querySelector('button')!);
    expect(container.querySelectorAll('button').length).toBeGreaterThan(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    // Only the trigger button remains
    expect(container.querySelectorAll('button').length).toBe(1);
  });

  it('closes when clicking outside', async () => {
    render(
      <div>
        <ColorPicker selected="#ff0000" onSelect={() => {}} />
        <button>Outside</button>
      </div>,
    );

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]); // open

    fireEvent.mouseDown(screen.getByText('Outside'));
    // After closing, only "Outside" + trigger remain (no preset colors)
    expect(screen.getAllByRole('button').length).toBe(2);
  });
});
