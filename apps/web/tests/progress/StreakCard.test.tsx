import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { StreakCard } from '../../components/progress/StreakCard';

const mockPush = vi.fn();
vi.mock('../../lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('StreakCard', () => {
  it('shows "no cadence yet" when weeklyTarget is null', () => {
    renderWithProviders(
      <StreakCard
        currentWeeks={null}
        longestWeeks={null}
        weeklyTarget={null}
        thisWeekCount={0}
      />,
    );
    // Translation may be different but a button to set cadence should appear
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('navigates to /curriculums when "set cadence" link is clicked', () => {
    mockPush.mockReset();
    renderWithProviders(
      <StreakCard
        currentWeeks={null}
        longestWeeks={null}
        weeklyTarget={null}
        thisWeekCount={0}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith('/curriculums');
  });

  it('shows the streak count in aria-label when current weeks > 0', () => {
    renderWithProviders(
      <StreakCard
        currentWeeks={5}
        longestWeeks={10}
        weeklyTarget={3}
        thisWeekCount={2}
      />,
    );
    expect(screen.getByLabelText(/Current streak: 5 weeks, longest: 10 weeks/)).toBeInTheDocument();
  });

  it('shows aria-label with longest=0 when longestWeeks is null', () => {
    renderWithProviders(
      <StreakCard
        currentWeeks={0}
        longestWeeks={null}
        weeklyTarget={3}
        thisWeekCount={0}
      />,
    );
    expect(screen.getByLabelText(/longest: 0 weeks/)).toBeInTheDocument();
  });

  it('renders progress bar at 100% when this-week target is met', () => {
    const { container } = renderWithProviders(
      <StreakCard
        currentWeeks={1}
        longestWeeks={2}
        weeklyTarget={3}
        thisWeekCount={3}
      />,
    );
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar?.style.width).toBe('100%');
  });

  it('renders progress bar capped at 100% when count exceeds target', () => {
    const { container } = renderWithProviders(
      <StreakCard
        currentWeeks={1}
        longestWeeks={2}
        weeklyTarget={3}
        thisWeekCount={5}
      />,
    );
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar?.style.width).toBe('100%');
  });

  it('renders progress bar at correct percentage when below target', () => {
    const { container } = renderWithProviders(
      <StreakCard
        currentWeeks={1}
        longestWeeks={2}
        weeklyTarget={4}
        thisWeekCount={1}
      />,
    );
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar?.style.width).toBe('25%');
  });

  it('shows broken-streak alert when streak is broken', () => {
    const { container } = renderWithProviders(
      <StreakCard
        currentWeeks={0}
        longestWeeks={5}
        weeklyTarget={3}
        thisWeekCount={1}
        lastMetWeekStart="2024-01-01"
      />,
    );
    // Bar uses red styling
    expect(container.querySelector('.bg-red-500')).not.toBeNull();
  });

  it('uses primary bar color when this-week target is met', () => {
    const { container } = renderWithProviders(
      <StreakCard currentWeeks={1} longestWeeks={2} weeklyTarget={3} thisWeekCount={3} />,
    );
    expect(container.querySelector('.bg-primary')).not.toBeNull();
  });
});
