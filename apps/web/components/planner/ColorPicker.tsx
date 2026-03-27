'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CUSTOM_COLORS } from './types';

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
          open
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span
          className="w-6 h-6 rounded-full"
          style={{ backgroundColor: selected }}
        />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-12 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3">
          <div className="grid grid-cols-6 gap-1.5">
            {CUSTOM_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                className={`w-8 h-8 rounded-full transition-transform ${
                  selected === c ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
