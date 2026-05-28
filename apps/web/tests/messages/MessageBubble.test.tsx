import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { MessageBubble } from '../../components/messages/MessageBubble';

const baseMsg = {
  id: 'm1',
  thread_id: 't1',
  author_family_id: 'fam-a',
  body: 'Hello\nworld',
  created_at: new Date().toISOString(),
};

describe('MessageBubble', () => {
  it("renders the body with preserved newlines", () => {
    renderWithProviders(<MessageBubble message={baseMsg} mine />);
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/Hello/).className).toMatch(/whitespace-pre-wrap/);
  });

  it("right-aligns when the message is mine", () => {
    const { container } = renderWithProviders(
      <MessageBubble message={baseMsg} mine />,
    );
    expect(container.firstChild?.firstChild).toBeTruthy();
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/justify-end/);
  });

  it("left-aligns when the message is not mine", () => {
    const { container } = renderWithProviders(
      <MessageBubble message={baseMsg} mine={false} />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/justify-start/);
  });
});
