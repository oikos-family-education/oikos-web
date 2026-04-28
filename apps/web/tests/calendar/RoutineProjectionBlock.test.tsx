import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../utils/renderWithProviders';
import { RoutineProjectionBlockView } from '../../components/calendar/RoutineProjectionBlock';
import type { RoutineProjectionBlock } from '../../components/calendar/types';

const baseBlock = (overrides: Partial<RoutineProjectionBlock> = {}): RoutineProjectionBlock => ({
  entry_id: 'r1',
  date: '2024-06-15',
  day_of_week: 5,
  start_minute: 540, // 09:00
  duration_minutes: 60,
  subject_id: 's1',
  subject_name: 'Math',
  is_free_time: false,
  child_ids: [],
  color: '#4f46e5',
  notes: null,
  ...overrides,
});

describe('RoutineProjectionBlockView', () => {
  it('renders the subject name', () => {
    const { getByText } = renderWithProviders(
      <RoutineProjectionBlockView block={baseBlock()} />,
    );
    expect(getByText('Math')).toBeInTheDocument();
  });

  it('renders "Free time" when is_free_time=true', () => {
    const { getByText } = renderWithProviders(
      <RoutineProjectionBlockView block={baseBlock({ is_free_time: true, subject_name: null })} />,
    );
    expect(getByText('Free time')).toBeInTheDocument();
  });

  it('renders "Custom" when subject_name is null and not free time', () => {
    const { getByText } = renderWithProviders(
      <RoutineProjectionBlockView
        block={baseBlock({ is_free_time: false, subject_name: null })}
      />,
    );
    expect(getByText('Custom')).toBeInTheDocument();
  });

  it('returns null when block is before display range', () => {
    const { container } = renderWithProviders(
      <RoutineProjectionBlockView block={baseBlock({ start_minute: 0 })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('positions the block according to start_minute', () => {
    const { container } = renderWithProviders(
      <RoutineProjectionBlockView block={baseBlock({ start_minute: 600 })} />, // 10:00
    );
    const div = container.querySelector('div[style]') as HTMLElement;
    // 10:00 - 06:00 = 4 hours, ROW_HEIGHT=56 → top = 224px
    expect(div.style.top).toBe('224px');
  });

  it('uses fallback color when block.color is null', () => {
    const { container } = renderWithProviders(
      <RoutineProjectionBlockView block={baseBlock({ color: null })} />,
    );
    const div = container.querySelector('div[style]') as HTMLElement;
    // The fallback is #cbd5e140 (semi-transparent slate-300)
    expect(div.style.backgroundColor).toBeTruthy();
  });
});
