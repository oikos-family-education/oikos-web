import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { MiniCalendar } from '../../components/calendar/MiniCalendar';

describe('MiniCalendar', () => {
  const baseDate = new Date(2024, 5, 15); // June 15, 2024 (Saturday)

  it('renders the current month and year header', () => {
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set()} />,
    );
    expect(screen.getByText(/June 2024/i)).toBeInTheDocument();
  });

  it('renders 42 day-buttons (6 weeks × 7 days) plus weekday headers + today button', () => {
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set()} />,
    );
    const buttons = screen.getAllByRole('button');
    // 42 days + 2 prev/next + 1 today = 45
    expect(buttons.length).toBe(45);
  });

  it('navigates to the previous month when the back arrow is clicked', () => {
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set()} />,
    );
    fireEvent.click(screen.getByLabelText(/previous month/i));
    expect(screen.getByText(/May 2024/i)).toBeInTheDocument();
  });

  it('navigates to the next month when the forward arrow is clicked', () => {
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set()} />,
    );
    fireEvent.click(screen.getByLabelText(/next month/i));
    expect(screen.getByText(/July 2024/i)).toBeInTheDocument();
  });

  it('calls onChange when a day is clicked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={onChange} daysWithEvents={new Set()} />,
    );
    // Click "1" (the first day of the month)
    const dayCells = screen.getAllByText('1');
    fireEvent.click(dayCells[0]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('today button calls onChange with today\'s date', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MiniCalendar value={baseDate} onChange={onChange} daysWithEvents={new Set()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^today$/i }));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as Date;
    const today = new Date();
    expect(arg.getFullYear()).toBe(today.getFullYear());
    expect(arg.getMonth()).toBe(today.getMonth());
  });

  it('marks the selected day with the primary background', () => {
    const { container } = renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set()} />,
    );
    expect(container.querySelector('.bg-primary')).not.toBeNull();
  });

  it('shows event dots for days in daysWithEvents', () => {
    const eventDay = `${baseDate.getFullYear()}-${baseDate.getMonth() + 1}-20`;
    const { container } = renderWithProviders(
      <MiniCalendar value={baseDate} onChange={() => {}} daysWithEvents={new Set([eventDay])} />,
    );
    // The dot is the small absolute span
    const dot = container.querySelector('span.bg-primary.rounded-full');
    expect(dot).not.toBeNull();
  });
});
