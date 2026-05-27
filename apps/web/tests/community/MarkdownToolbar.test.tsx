import React, { useRef, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { MarkdownToolbar } from '../../components/community/MarkdownToolbar';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <MarkdownToolbar value={value} onChange={setValue} textareaRef={ref} />
      <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} data-testid="ta" />
    </>
  );
}

describe('MarkdownToolbar', () => {
  it('wraps selection in ** when Bold is clicked', () => {
    renderWithProviders(<Harness initial="hello" />);
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement;
    ta.setSelectionRange(0, 5);
    fireEvent.click(screen.getByTitle('Bold'));
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('**hello**');
  });

  it('prefixes selected lines with - for unordered list', () => {
    renderWithProviders(<Harness initial="a\nb\nc" />);
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement;
    ta.setSelectionRange(0, ta.value.length);
    fireEvent.click(screen.getByTitle('Bulleted list'));
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toMatch(/^- /);
  });

  it('opens a link popover and inserts a markdown link', () => {
    renderWithProviders(<Harness initial="text" />);
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement;
    ta.setSelectionRange(0, 4);
    fireEvent.click(screen.getByTitle('Link'));
    const input = screen.getByPlaceholderText(/^https/i);
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByText('Insert link'));
    expect((screen.getByTestId('ta') as HTMLTextAreaElement).value).toBe('[text](https://example.com)');
  });
});
