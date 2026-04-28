import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../components/dashboard/TopBar';

describe('TopBar', () => {
  it('renders the menu button', () => {
    render(<TopBar onMenuClick={() => {}} />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('calls onMenuClick when the menu button is clicked', () => {
    const onMenuClick = vi.fn();
    render(<TopBar onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(onMenuClick).toHaveBeenCalledOnce();
  });

  it('is hidden on large screens (uses lg:hidden class)', () => {
    const { container } = render(<TopBar onMenuClick={() => {}} />);
    expect(container.querySelector('header')?.className).toContain('lg:hidden');
  });
});
