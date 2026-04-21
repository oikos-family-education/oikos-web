'use client';

import React from 'react';
import { CalendarEvent, getEventColor, parseServerDate } from './types';

interface EventPillProps {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
  showTime?: boolean;
  compact?: boolean;
}

export function EventPill({ event, onClick, showTime = false, compact = false }: EventPillProps) {
  const color = getEventColor(event);
  const isSystem = event.is_system;
  const start = parseServerDate(event.start_at);
  const timeStr = event.all_day
    ? null
    : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`w-full text-left truncate rounded px-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 ${
        compact ? 'h-4' : 'h-5'
      } ${isSystem ? 'border border-dashed' : ''}`}
      style={{
        backgroundColor: color,
        borderColor: isSystem ? 'rgba(255,255,255,0.6)' : undefined,
      }}
      title={event.title}
    >
      {showTime && timeStr && <span className="mr-1 opacity-80">{timeStr}</span>}
      {event.title}
    </button>
  );
}
