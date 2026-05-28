import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { Composer } from '../../components/messages/Composer';

describe('Composer', () => {
  it('sends on Cmd+Enter and clears the body', async () => {
    const onSend = vi.fn(async () => {});
    renderWithProviders(<Composer onSend={onSend} />);
    const ta = screen.getByPlaceholderText(/Write a message/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('hello'));
    await waitFor(() => expect(ta.value).toBe(''));
  });

  it('sends on Ctrl+Enter (Windows / Linux)', async () => {
    const onSend = vi.fn(async () => {});
    renderWithProviders(<Composer onSend={onSend} />);
    const ta = screen.getByPlaceholderText(/Write a message/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hi' } });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('hi'));
  });

  it('plain Enter does NOT submit (inserts a newline instead)', async () => {
    const onSend = vi.fn();
    renderWithProviders(<Composer onSend={onSend} />);
    const ta = screen.getByPlaceholderText(/Write a message/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hi' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables the textarea + send button when disabled is set, showing the reason', () => {
    renderWithProviders(
      <Composer
        disabled
        disabledReason="You blocked this family."
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByText(/blocked this family/i)).toBeInTheDocument();
    // The textarea/send button block is not rendered in disabled mode.
    expect(screen.queryByPlaceholderText(/Write a message/i)).toBeNull();
  });

  it('does not submit when body is whitespace-only', async () => {
    const onSend = vi.fn();
    renderWithProviders(<Composer onSend={onSend} />);
    const ta = screen.getByPlaceholderText(/Write a message/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '   ' } });
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
