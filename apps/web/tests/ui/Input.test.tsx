import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@oikos/ui';

describe('Input', () => {
  it('renders the label text', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders a red asterisk when required=true', () => {
    render(<Input label="Email" required />);
    const asterisk = screen.getByText('*');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk.className).toContain('text-red-500');
  });

  it('does not render asterisk when required is omitted', () => {
    render(<Input label="Email" />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('renders error message text when error prop is provided', () => {
    render(<Input label="Email" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('does not render error message when error prop is omitted', () => {
    render(<Input label="Email" />);
    // no error span
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('applies red border class when error is present', () => {
    render(<Input label="Email" error="Bad input" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-red-500');
  });

  it('does not apply red border without an error', () => {
    render(<Input label="Email" />);
    const input = screen.getByRole('textbox');
    expect(input.className).not.toContain('border-red-500');
  });

  it('forwards ref to the underlying input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input label="Name" ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('passes arbitrary props (placeholder, type) to the input', () => {
    render(<Input label="Password" type="password" placeholder="Enter password" />);
    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders the icon slot when icon prop is provided', () => {
    render(<Input label="Search" icon={<span data-testid="icon">🔍</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
