import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@oikos/ui';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('has the required layout classes', () => {
    render(<Button>Layout</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('inline-flex');
    expect(btn.className).toContain('items-center');
    expect(btn.className).toContain('justify-center');
    expect(btn.className).toContain('whitespace-nowrap');
  });

  it('calls onClick when clicked', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Press</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const handler = vi.fn();
    render(<Button onClick={handler} disabled>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects type="submit"', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('respects type="button"', () => {
    render(<Button type="button">Button</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>{"Can't touch this"}</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className with base classes', () => {
    render(<Button className="my-custom-class">Styled</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('my-custom-class');
    expect(btn.className).toContain('inline-flex');
  });
});
