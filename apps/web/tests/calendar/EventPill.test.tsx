import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventPill } from '../../components/calendar/EventPill';
import type { CalendarEvent } from '../../components/calendar/types';
import { EVENT_TYPE_COLORS } from '../../components/calendar/types';

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  family_id: 'f1',
  title: 'Test Event',
  description: null,
  event_type: 'family',
  all_day: false,
  start_at: '2024-06-15T09:30:00Z',
  end_at: '2024-06-15T10:30:00Z',
  child_ids: [],
  subject_id: null,
  project_id: null,
  milestone_id: null,
  color: null,
  location: null,
  recurrence: 'none',
  is_system: false,
  source_url: null,
  ...overrides,
});

describe('EventPill', () => {
  it('renders the event title', () => {
    render(<EventPill event={baseEvent()} />);
    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });

  it('shows time prefix when showTime is true and not all-day', () => {
    render(<EventPill event={baseEvent()} showTime />);
    // Time display depends on local timezone — we check the title appears together with HH:MM
    const button = screen.getByRole('button');
    expect(button.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('does not show a time prefix for all-day events', () => {
    const { container } = render(<EventPill event={baseEvent({ all_day: true })} showTime />);
    // No "HH:MM " span
    expect(container.querySelector('span.opacity-80')).toBeNull();
  });

  it('uses the custom event color', () => {
    const { container } = render(<EventPill event={baseEvent({ color: '#aabbcc' })} />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('style')).toContain('rgb(170, 187, 204)');
  });

  it('uses event type color when no custom color is set', () => {
    const { container } = render(<EventPill event={baseEvent({ event_type: 'subject' })} />);
    const button = container.querySelector('button');
    // EVENT_TYPE_COLORS.subject is #f59e0b → rgb(245, 158, 11)
    expect(button?.getAttribute('style')).toContain('rgb(245, 158, 11)');
  });

  it('uses dashed border for system events', () => {
    const { container } = render(<EventPill event={baseEvent({ is_system: true })} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border-dashed');
  });

  it('applies compact class when compact=true', () => {
    const { container } = render(<EventPill event={baseEvent()} compact />);
    expect(container.querySelector('button.h-4')).not.toBeNull();
  });

  it('applies normal h-5 class when compact=false', () => {
    const { container } = render(<EventPill event={baseEvent()} />);
    expect(container.querySelector('button.h-5')).not.toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<EventPill event={baseEvent()} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('stops propagation on click (clicks do not bubble)', () => {
    const parentClick = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <EventPill event={baseEvent()} onClick={onClick} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
