'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { icons, Search } from 'lucide-react';

const EDUCATION_ICONS = [
  'BookOpen', 'Book', 'BookMarked', 'BookText', 'Library',
  'GraduationCap', 'School', 'Apple', 'Pencil', 'PenTool',
  'PenLine', 'Highlighter', 'Eraser', 'Notebook', 'NotebookPen',
  'Calculator', 'Ruler', 'Triangle', 'Pi', 'Sigma',
  'Plus', 'Divide', 'Percent', 'Hash', 'Binary',
  'Globe', 'Earth', 'Map', 'MapPin', 'Compass',
  'Music', 'Music2', 'Guitar', 'Drum', 'Piano',
  'Palette', 'Paintbrush', 'Brush', 'Shapes', 'Figma',
  'Brain', 'Lightbulb', 'Sparkles', 'Atom', 'Dna',
  'Microscope', 'FlaskConical', 'TestTube2', 'Beaker', 'Magnet',
  'Leaf', 'TreePine', 'Flower2', 'Sprout', 'Sun',
  'Star', 'Heart', 'Trophy', 'Award', 'Medal',
  'Clock', 'Calendar', 'Timer', 'Hourglass', 'AlarmClock',
  'Monitor', 'Laptop', 'Tablet', 'Cpu', 'Code',
  'Camera', 'Film', 'Clapperboard', 'Video', 'Mic',
  'Dumbbell', 'Bike', 'Footprints', 'Activity', 'HeartPulse',
  'Languages', 'MessageCircle', 'Type', 'Quote', 'FileText',
  'Puzzle', 'Target', 'Rocket', 'Telescope', 'Eye',
  'Users', 'HandHeart', 'Church', 'Cross', 'Scroll',
];

interface IconPickerProps {
  value: string | null;
  onChange: (iconName: string) => void;
  color: string;
}

export function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedIconName = value || 'BookOpen';

  const filteredIcons = useMemo(() => {
    if (!search.trim()) {
      return EDUCATION_ICONS.filter((name) => name in icons);
    }
    const query = search.toLowerCase();
    return Object.keys(icons).filter((name) =>
      name.toLowerCase().includes(query)
    );
  }, [search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  function handleSelect(iconName: string) {
    onChange(iconName);
    setIsOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        {selectedIconName in icons
          ? React.createElement(icons[selectedIconName as keyof typeof icons], {
              className: 'w-5 h-5',
              style: { color },
            })
          : React.createElement(icons['BookOpen'], {
              className: 'w-5 h-5',
              style: { color },
            })}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="p-2 max-h-56 overflow-y-auto">
            {filteredIcons.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No icons found</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {filteredIcons.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => handleSelect(name)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                      name === selectedIconName
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {React.createElement(icons[name as keyof typeof icons], {
                      className: 'w-4 h-4',
                      style: { color: name === selectedIconName ? color : undefined },
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
