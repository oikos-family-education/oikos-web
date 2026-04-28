import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ArchiveModal } from '../../components/children/ArchiveModal';

describe('ArchiveModal', () => {
  it('renders the child name in the title', () => {
    renderWithProviders(
      <ArchiveModal childName="Alice" onConfirm={() => {}} onCancel={() => {}} />,
    );
    // The title and the body both interpolate the name — at least one match
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <ArchiveModal childName="Alice" onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ArchiveModal childName="Alice" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    // Confirm button has the red styling — find by role excluding cancel
    const buttons = screen.getAllByRole('button');
    const confirm = buttons.find((b) => b !== screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(confirm!);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when clicking the backdrop', () => {
    const onCancel = vi.fn();
    const { container } = renderWithProviders(
      <ArchiveModal childName="Alice" onConfirm={() => {}} onCancel={onCancel} />,
    );
    const backdrop = container.querySelector('.bg-black\\/30');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
