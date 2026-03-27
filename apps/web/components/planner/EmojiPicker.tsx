'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Activities',
    emojis: [
      '✏️', '📖', '📚', '📝', '🎨', '🎵', '🎶', '🎹', '🎸', '🥁',
      '🎭', '🎬', '🎤', '🎧', '🏃', '⚽', '🏀', '🎾', '🏊', '🚴',
      '🤸', '🧘', '🏋️', '⛹️', '🤾', '🎯', '🏓', '🏸', '🥋', '🤺',
    ],
  },
  {
    label: 'Learning',
    emojis: [
      '🔬', '🧪', '🧬', '🔭', '💻', '🖥️', '⌨️', '🧮', '📐', '📏',
      '🗺️', '🌍', '🌎', '🌏', '🏛️', '📊', '📈', '🧠', '💡', '📎',
      '🔧', '🔨', '⚙️', '🛠️', '🧰', '🧩', '🎲', '♟️', '🪄', '🔑',
    ],
  },
  {
    label: 'Nature',
    emojis: [
      '🌿', '🌱', '🌳', '🌻', '🌺', '🍀', '🌾', '🦋', '🐝', '🐞',
      '🐟', '🐬', '🦎', '🦅', '🐾', '🌊', '🏔️', '🌄', '☀️', '🌙',
      '⭐', '🌈', '❄️', '🔥', '💧', '🌸', '🍁', '🍂', '🌵', '🪴',
    ],
  },
  {
    label: 'Food',
    emojis: [
      '🍎', '🍊', '🍋', '🍓', '🫐', '🥑', '🥕', '🌽', '🍕', '🍰',
      '🧁', '🍪', '🥤', '☕', '🍵', '🥗', '🍳', '🥐', '🍞', '🧀',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '📱', '💰', '🎁', '🏠', '🚗', '✈️', '🚂', '⛵', '🎪', '🎡',
      '📷', '🎥', '📺', '🔔', '💎', '👑', '🏆', '🥇', '🎖️', '🏅',
      '📌', '✂️', '🖊️', '🖌️', '📋', '📦', '🗂️', '📁', '🗃️', '🧲',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '❤️', '💛', '💚', '💙', '💜', '🤍', '🖤', '🤎', '✅', '❌',
      '⚡', '💫', '🔮', '🎀', '🪐', '♻️', '⚠️', '🔒', '🔓', '💬',
    ],
  },
];

interface EmojiPickerProps {
  selected: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ selected, onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCategories = useMemo(() => {
    if (!search) return EMOJI_CATEGORIES;
    const lowerSearch = search.toLowerCase();
    const filtered = EMOJI_CATEGORIES.map(cat => ({
      ...cat,
      emojis: cat.label.toLowerCase().includes(lowerSearch) ? cat.emojis : [],
    })).filter(cat => cat.emojis.length > 0);
    return filtered.length > 0 ? filtered : EMOJI_CATEGORIES;
  }, [search]);

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
        className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl transition-colors ${
          open
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
        }`}
      >
        {selected}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter category..."
              className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {filteredCategories.map((cat, idx) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(idx)}
                className={`px-2 py-0.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                  activeCategory === idx
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto">
            {(filteredCategories[activeCategory]?.emojis || []).map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors ${
                  selected === emoji
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-slate-100'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
