import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from '../../components/planner/EmojiPicker';

describe('EmojiPicker', () => {
  it('renders the trigger with the selected emoji', () => {
    render(<EmojiPicker selected="🎵" onSelect={() => {}} />);
    expect(screen.getByText('🎵')).toBeInTheDocument();
  });

  it('opens picker on click', async () => {
    render(<EmojiPicker selected="🎵" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('🎵'));
    // Search input + categories appear
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/activities/i)).toBeInTheDocument();
  });

  it('calls onSelect when an emoji is clicked', async () => {
    const onSelect = vi.fn();
    render(<EmojiPicker selected="🎵" onSelect={onSelect} />);
    await userEvent.click(screen.getByText('🎵'));

    // Click pencil emoji from Activities (first category)
    await userEvent.click(screen.getByText('✏️'));
    expect(onSelect).toHaveBeenCalledWith('✏️');
  });

  it('switches categories when clicking a tab', async () => {
    render(<EmojiPicker selected="🎵" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('🎵'));

    // Click the Nature category tab
    await userEvent.click(screen.getByText('Nature'));
    // After switch, a Nature emoji appears (e.g., 🌿)
    expect(screen.getByText('🌿')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', async () => {
    render(<EmojiPicker selected="🎵" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('🎵'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', async () => {
    render(
      <div>
        <EmojiPicker selected="🎵" onSelect={() => {}} />
        <button>Outside</button>
      </div>,
    );
    await userEvent.click(screen.getByText('🎵'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('filters categories by search query', async () => {
    render(<EmojiPicker selected="🎵" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('🎵'));

    await userEvent.type(screen.getByRole('textbox'), 'food');
    // After filter, "Food" tab is visible
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});
