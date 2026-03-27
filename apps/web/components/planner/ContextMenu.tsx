'use client';

import React, { useEffect, useRef } from 'react';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ContextMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onEdit, onDuplicate, onDelete, onClose }: ContextMenuProps) {
  const t = useTranslations('WeekPlanner');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items = [
    { label: t('edit'), icon: Pencil, onClick: onEdit },
    { label: t('duplicate'), icon: Copy, onClick: onDuplicate },
    { label: t('delete'), icon: Trash2, onClick: onDelete, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]"
      style={{ top: y, left: x }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 ${
            item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700'
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
