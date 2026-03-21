'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ShieldConfig {
  initials: string;
  shape: string;
  background_color: string;
  accent_color: string;
  dividing_pattern: string;
  font_style: string;
}

interface Props {
  config: ShieldConfig;
  onChange: (config: ShieldConfig) => void;
}

const CURATED_COLORS = [
  { bg: '#2D4A7A', accent: '#C5A84B' },
  { bg: '#1B3A4B', accent: '#E8D5B7' },
  { bg: '#4A2D7A', accent: '#D4A84B' },
  { bg: '#7A2D4A', accent: '#E8C5A8' },
  { bg: '#2B6B4F', accent: '#D4C44B' },
  { bg: '#8B4513', accent: '#F5DEB3' },
  { bg: '#2F4F4F', accent: '#FFD700' },
  { bg: '#4B0082', accent: '#DA70D6' },
  { bg: '#191970', accent: '#87CEEB' },
  { bg: '#3C1414', accent: '#CD853F' },
];

const SHAPES: { value: string; label: string; path: string }[] = [
  {
    value: 'heater',
    label: 'Classic',
    path: 'M 50 5 L 95 25 L 95 55 Q 95 90 50 97 Q 5 90 5 55 L 5 25 Z',
  },
  {
    value: 'rounded',
    label: 'Rounded',
    path: 'M 50 5 Q 95 5 95 30 L 95 60 Q 95 95 50 97 Q 5 95 5 60 L 5 30 Q 5 5 50 5 Z',
  },
  {
    value: 'angular',
    label: 'Angular',
    path: 'M 50 2 L 98 20 L 90 70 L 50 98 L 10 70 L 2 20 Z',
  },
  {
    value: 'split',
    label: 'Split',
    path: 'M 50 5 L 95 15 L 95 60 L 50 97 L 5 60 L 5 15 Z',
  },
];

const FONT_MAP: Record<string, string> = {
  serif: "'Georgia', serif",
  sans: "'Inter', sans-serif",
  script: "'Georgia', cursive",
};

export function ShieldBuilder({ config, onChange }: Props) {
  const t = useTranslations('Onboarding');
  const currentShape = SHAPES.find(s => s.value === config.shape) || SHAPES[0];

  const renderPattern = () => {
    if (config.dividing_pattern === 'none') return null;
    const patternPaths: Record<string, JSX.Element> = {
      horizontal: <line x1="5" y1="50" x2="95" y2="50" stroke={config.accent_color} strokeWidth="2" opacity="0.4" />,
      diagonal: <line x1="5" y1="5" x2="95" y2="97" stroke={config.accent_color} strokeWidth="2" opacity="0.4" />,
      quarterly: (
        <>
          <line x1="50" y1="5" x2="50" y2="97" stroke={config.accent_color} strokeWidth="2" opacity="0.4" />
          <line x1="5" y1="50" x2="95" y2="50" stroke={config.accent_color} strokeWidth="2" opacity="0.4" />
        </>
      ),
    };
    return patternPaths[config.dividing_pattern] || null;
  };

  return (
    <div className="space-y-5">
      <label className="text-sm font-semibold text-slate-700">{t('shieldLabel')}</label>

      <div className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Shield Preview */}
        <div className="flex-shrink-0 flex justify-center">
          <svg viewBox="0 0 100 100" width="160" height="160" className="drop-shadow-lg">
            <defs>
              <clipPath id="shieldClip">
                <path d={currentShape.path} />
              </clipPath>
            </defs>
            <path d={currentShape.path} fill={config.background_color} stroke={config.accent_color} strokeWidth="2" />
            {renderPattern()}
            <text
              x="50"
              y="55"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={config.accent_color}
              fontFamily={FONT_MAP[config.font_style] || FONT_MAP.serif}
              fontSize={config.initials.length > 2 ? '18' : '24'}
              fontWeight="bold"
            >
              {config.initials || '?'}
            </text>
          </svg>
        </div>

        {/* Shield Controls */}
        <div className="flex-1 space-y-5">
          {/* Shape Picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldShape')}</p>
            <div className="flex gap-3">
              {SHAPES.map(shape => (
                <button
                  key={shape.value}
                  type="button"
                  onClick={() => onChange({ ...config, shape: shape.value })}
                  className={`w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center ${config.shape === shape.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                  title={shape.label}
                >
                  <svg viewBox="0 0 100 100" width="28" height="28">
                    <path d={shape.path} fill="#94a3b8" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldColor')}</p>
            <div className="flex flex-wrap gap-2">
              {CURATED_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ ...config, background_color: c.bg, accent_color: c.accent })}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${config.background_color === c.bg ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.bg }}
                  title={`Color ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Pattern */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldPattern')}</p>
            <div className="flex gap-2">
              {['none', 'horizontal', 'diagonal', 'quarterly'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...config, dividing_pattern: p })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all font-medium ${config.dividing_pattern === p ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldFont')}</p>
            <div className="flex gap-2">
              {['serif', 'sans', 'script'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...config, font_style: f })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all font-medium ${config.font_style === f ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  style={{ fontFamily: FONT_MAP[f] }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{t('shieldHelp')}</p>
    </div>
  );
}
