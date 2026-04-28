import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from '../../components/ui/Alert';

describe('Alert', () => {
  it('renders the message text', () => {
    render(<Alert type="error" message="Bad things" />);
    expect(screen.getByText('Bad things')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<Alert type="error" message="Hi" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies error styles when type is error', () => {
    render(<Alert type="error" message="Oh no" />);
    const node = screen.getByRole('alert');
    expect(node.className).toContain('bg-red-50');
    expect(node.className).toContain('text-red-800');
  });

  it('applies success styles when type is success', () => {
    render(<Alert type="success" message="Yay" />);
    const node = screen.getByRole('alert');
    expect(node.className).toContain('bg-green-50');
    expect(node.className).toContain('text-green-800');
  });
});
