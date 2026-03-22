'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle } from 'lucide-react';

/* ─────────────── Types ─────────────── */
export interface ShieldConfig {
  initials: string;
  shape: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  division: string;
  crest_animal: string;
  flourish: string;
  center_symbol: string;
  motto: string;
  font_style: string;
}

interface Props {
  config: ShieldConfig;
  familyName: string;
  onChange: (config: ShieldConfig) => void;
}

/* ─────────────── Data ─────────────── */

const SHAPES: { value: string; label: string; path: string }[] = [
  { value: 'heater', label: 'Classic', path: 'M 50 8 L 92 24 L 92 55 Q 92 88 50 96 Q 8 88 8 55 L 8 24 Z' },
  { value: 'rounded', label: 'Rounded', path: 'M 50 8 Q 92 8 92 30 L 92 60 Q 92 92 50 96 Q 8 92 8 60 L 8 30 Q 8 8 50 8 Z' },
  { value: 'kite', label: 'Kite', path: 'M 50 4 L 90 30 L 90 65 L 50 98 L 10 65 L 10 30 Z' },
  { value: 'swiss', label: 'Swiss', path: 'M 50 6 C 80 6 92 18 92 30 L 92 58 C 92 80 72 94 50 96 C 28 94 8 80 8 58 L 8 30 C 8 18 20 6 50 6 Z' },
  { value: 'french', label: 'French', path: 'M 50 6 L 92 6 L 92 60 Q 92 92 50 96 Q 8 92 8 60 L 8 6 Z' },
  { value: 'polish', label: 'Polish', path: 'M 50 4 Q 75 4 88 14 Q 96 22 94 36 L 90 65 Q 85 85 50 96 Q 15 85 10 65 L 6 36 Q 4 22 12 14 Q 25 4 50 4 Z' },
  { value: 'lozenge', label: 'Lozenge', path: 'M 50 4 L 94 50 L 50 96 L 6 50 Z' },
  { value: 'oval', label: 'Oval', path: 'M 50 6 C 82 6 92 26 92 50 C 92 74 82 94 50 94 C 18 94 8 74 8 50 C 8 26 18 6 50 6 Z' },
];

const PRIMARY_COLORS = [
  { value: '#1B2A4A', label: 'Azure' },
  { value: '#8B0000', label: 'Gules' },
  { value: '#1A5C2E', label: 'Vert' },
  { value: '#2B1055', label: 'Purpure' },
  { value: '#1C1C1C', label: 'Sable' },
  { value: '#8B4513', label: 'Tenné' },
  { value: '#B22222', label: 'Sanguine' },
  { value: '#4A0E0E', label: 'Murrey' },
  { value: '#2F4F4F', label: 'Dark Teal' },
  { value: '#191970', label: 'Navy' },
];

const SECONDARY_COLORS = [
  { value: '#C5A84B', label: 'Or (Gold)' },
  { value: '#E8E8E8', label: 'Argent (Silver)' },
  { value: '#F5DEB3', label: 'Wheat' },
  { value: '#CD853F', label: 'Peru' },
  { value: '#DAA520', label: 'Goldenrod' },
  { value: '#B8860B', label: 'Dark Gold' },
  { value: '#D4A84B', label: 'Brass' },
  { value: '#E8D5B7', label: 'Champagne' },
  { value: '#FAFAD2', label: 'Light Gold' },
  { value: '#FFD700', label: 'Bright Gold' },
];

type Division = { value: string; label: string; render: (p: string, s: string, path: string) => JSX.Element };

const DIVISIONS: Division[] = [
  { value: 'none', label: 'Plain', render: () => <></> },
  {
    value: 'per_fess', label: 'Per Fess',
    render: (_, s) => <rect x="0" y="50" width="100" height="50" fill={s} clipPath="url(#shieldClip)" />,
  },
  {
    value: 'per_pale', label: 'Per Pale',
    render: (_, s) => <rect x="50" y="0" width="50" height="100" fill={s} clipPath="url(#shieldClip)" />,
  },
  {
    value: 'per_bend', label: 'Per Bend',
    render: (_, s) => <polygon points="0,0 100,0 100,100" fill={s} clipPath="url(#shieldClip)" />,
  },
  {
    value: 'per_bend_sinister', label: 'Per Bend Sin.',
    render: (_, s) => <polygon points="0,0 100,100 0,100" fill={s} clipPath="url(#shieldClip)" />,
  },
  {
    value: 'per_saltire', label: 'Per Saltire',
    render: (_, s) => (
      <>
        <polygon points="50,0 100,50 50,100" fill={s} clipPath="url(#shieldClip)" />
        <polygon points="0,50 50,0 0,0" fill={s} clipPath="url(#shieldClip)" opacity="0" />
        <polygon points="50,100 0,50 0,100" fill={s} clipPath="url(#shieldClip)" />
      </>
    ),
  },
  {
    value: 'quarterly', label: 'Quarterly',
    render: (_, s) => (
      <>
        <rect x="50" y="0" width="50" height="50" fill={s} clipPath="url(#shieldClip)" />
        <rect x="0" y="50" width="50" height="50" fill={s} clipPath="url(#shieldClip)" />
      </>
    ),
  },
  {
    value: 'per_chevron', label: 'Per Chevron',
    render: (_, s) => <polygon points="50,45 100,100 0,100" fill={s} clipPath="url(#shieldClip)" />,
  },
];

/* SVG path definitions for center symbols — 20x20 centered at origin */
const CENTER_SYMBOLS: { value: string; label: string; path: string }[] = [
  { value: 'none', label: 'None', path: '' },
  { value: 'cross', label: 'Cross', path: 'M-2,-8 L2,-8 L2,-2 L8,-2 L8,2 L2,2 L2,8 L-2,8 L-2,2 L-8,2 L-8,-2 L-2,-2 Z' },
  { value: 'star', label: 'Star', path: 'M0,-8 L2.4,-2.6 L8,-2.6 L3.6,1.6 L5.6,8 L0,4 L-5.6,8 L-3.6,1.6 L-8,-2.6 L-2.4,-2.6 Z' },
  { value: 'fleur', label: 'Fleur-de-lis', path: 'M0,-9 C2,-7 4,-4 3,-1 C6,-3 8,-3 8,0 C8,3 5,4 3,3 C4,6 2,9 0,9 C-2,9 -4,6 -3,3 C-5,4 -8,3 -8,0 C-8,-3 -6,-3 -3,-1 C-4,-4 -2,-7 0,-9 Z' },
  { value: 'lion_face', label: 'Lion', path: 'M0,-7 C5,-7 8,-3 8,1 C8,5 5,8 0,8 C-5,8 -8,5 -8,1 C-8,-3 -5,-7 0,-7 Z M-3,-3 C-4,-3 -4,-1 -3,-1 C-2,-1 -2,-3 -3,-3 Z M3,-3 C2,-3 2,-1 3,-1 C4,-1 4,-3 3,-3 Z M0,1 L-2,4 L0,3 L2,4 Z' },
  { value: 'eagle', label: 'Eagle', path: 'M0,-8 L3,-5 L8,-6 L5,-2 L8,2 L4,1 L2,5 L0,3 L-2,5 L-4,1 L-8,2 L-5,-2 L-8,-6 L-3,-5 Z' },
  { value: 'shield_mini', label: 'Escutcheon', path: 'M0,-7 L7,-3 L7,2 Q7,7 0,8 Q-7,7 -7,2 L-7,-3 Z' },
  { value: 'circle', label: 'Roundel', path: 'M0,-6 A6,6 0 1,1 0,6 A6,6 0 1,1 0,-6 Z' },
  { value: 'diamond', label: 'Lozenge', path: 'M0,-8 L6,0 L0,8 L-6,0 Z' },
  { value: 'crescent', label: 'Crescent', path: 'M-6,4 A7,7 0 1,1 6,4 A5,5 0 1,0 -6,4 Z' },
  { value: 'anchor', label: 'Anchor', path: 'M-1,-8 L1,-8 L1,-6 L3,-6 L3,-4 L1,-4 L1,2 L5,6 L4,8 L0,5 L-4,8 L-5,6 L-1,2 L-1,-4 L-3,-4 L-3,-6 L-1,-6 Z' },
  { value: 'heart', label: 'Heart', path: 'M0,7 C-8,0 -8,-5 -4,-7 C-1,-8 0,-5 0,-5 C0,-5 1,-8 4,-7 C8,-5 8,0 0,7 Z' },
  { value: 'sun', label: 'Sun', path: 'M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 Z M0,-8 L1,-5 L-1,-5 Z M0,8 L1,5 L-1,5 Z M-8,0 L-5,1 L-5,-1 Z M8,0 L5,1 L5,-1 Z M-5.6,-5.6 L-3.5,-3.5 L-4.5,-2.5 Z M5.6,5.6 L3.5,3.5 L4.5,2.5 Z M5.6,-5.6 L3.5,-3.5 L4.5,-2.5 Z M-5.6,5.6 L-3.5,3.5 L-4.5,2.5 Z' },
];

/* Crest animals — SVG paths rendered above the shield, 30x30 centered at origin */
const CREST_ANIMALS: { value: string; label: string; svg: string }[] = [
  { value: 'none', label: 'None', svg: '' },
  { value: 'eagle_crest', label: 'Eagle', svg: 'M0,-4 L-10,-1 L-8,2 L-3,0 L-1,4 L0,2 L1,4 L3,0 L8,2 L10,-1 Z M-2,-2 L0,-6 L2,-2 Z' },
  { value: 'lion_crest', label: 'Lion', svg: 'M-6,4 L-4,-2 C-4,-6 -2,-6 0,-4 C2,-6 4,-6 4,-2 L6,4 L4,6 L2,4 L0,6 L-2,4 L-4,6 Z M-2,-2 A1,1 0 1,0 -2,0 M2,-2 A1,1 0 1,0 2,0' },
  { value: 'wolf_crest', label: 'Wolf', svg: 'M-6,4 L-5,-2 L-3,-6 L-1,-2 L0,-4 L1,-2 L3,-6 L5,-2 L6,4 L3,6 L0,4 L-3,6 Z' },
  { value: 'horse_crest', label: 'Horse', svg: 'M-4,6 L-3,0 L-5,-3 L-3,-5 L0,-6 L3,-5 L4,-3 L5,-1 L4,2 L2,4 L3,6 Z M-1,-3 A1,1 0 1,0 -1,-1' },
  { value: 'deer_crest', label: 'Deer', svg: 'M-3,6 L-2,2 L-3,-1 L-2,-3 L0,-2 L2,-3 L3,-1 L2,2 L3,6 Z M-2,-3 L-5,-7 L-3,-5 L-4,-8 M2,-3 L5,-7 L3,-5 L4,-8' },
  { value: 'bear_crest', label: 'Bear', svg: 'M-5,5 L-6,0 L-5,-3 C-4,-6 -2,-6 0,-5 C2,-6 4,-6 5,-3 L6,0 L5,5 L3,6 L0,5 L-3,6 Z M-3,-3 A1,1 0 1,0 -3,-1 M3,-3 A1,1 0 1,0 3,-1' },
  { value: 'griffin_crest', label: 'Griffin', svg: 'M-6,5 L-4,-1 L-7,-2 L-4,-3 L-2,-6 L0,-3 L2,-6 L4,-3 L7,-2 L4,-1 L6,5 L3,3 L0,5 L-3,3 Z' },
  { value: 'owl_crest', label: 'Owl', svg: 'M-5,5 L-6,1 L-5,-3 L-3,-5 L0,-6 L3,-5 L5,-3 L6,1 L5,5 L0,6 Z M-3,-2 C-4,-2 -4,0 -3,0 C-2,0 -2,-2 -3,-2 Z M3,-2 C2,-2 2,0 3,0 C4,0 4,-2 3,-2 Z M0,1 L-1,3 L1,3 Z' },
  { value: 'dragon_crest', label: 'Dragon', svg: 'M-7,4 L-5,0 L-7,-3 L-4,-2 L-2,-6 L0,-3 L2,-6 L4,-2 L7,-3 L5,0 L7,4 L4,2 L2,5 L0,3 L-2,5 L-4,2 Z' },
  { value: 'phoenix_crest', label: 'Phoenix', svg: 'M0,-7 L-3,-4 L-6,-5 L-4,-1 L-8,1 L-4,2 L-5,5 L-2,3 L0,6 L2,3 L5,5 L4,2 L8,1 L4,-1 L6,-5 L3,-4 Z' },
  { value: 'dove_crest', label: 'Dove', svg: 'M-6,2 L-4,-1 L-2,-3 L0,-4 L3,-3 L5,-1 L6,2 L4,0 L2,2 L0,1 L-2,3 L-4,1 Z M-7,0 L-9,-1 L-7,-2 Z' },
];

/* Flourish patterns — decorative elements around the shield */
const FLOURISHES: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'laurel', label: 'Laurel Wreath' },
  { value: 'oak', label: 'Oak Branches' },
  { value: 'olive', label: 'Olive Branches' },
  { value: 'roses', label: 'Roses' },
  { value: 'ribbon', label: 'Ribbon' },
  { value: 'swords', label: 'Crossed Swords' },
  { value: 'wings', label: 'Wings' },
];

const FONT_MAP: Record<string, string> = {
  serif: "'Georgia', serif",
  sans: "'Inter', sans-serif",
  script: "'Georgia', cursive",
};

/* ─────────────── Flourish Renderer ─────────────── */

function renderFlourish(type: string, color: string): JSX.Element | null {
  if (type === 'none') return null;
  const c = color;
  const flourishSvg: Record<string, JSX.Element> = {
    laurel: (
      <g opacity="0.7">
        {/* Left branch */}
        <path d="M 38 85 Q 25 70 20 50 Q 18 40 22 30" stroke={c} strokeWidth="1.5" fill="none"/>
        <ellipse cx="22" cy="35" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(-30,22,35)"/>
        <ellipse cx="20" cy="45" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(-20,20,45)"/>
        <ellipse cx="21" cy="55" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(-10,21,55)"/>
        <ellipse cx="24" cy="65" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(0,24,65)"/>
        <ellipse cx="30" cy="75" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(15,30,75)"/>
        {/* Right branch */}
        <path d="M 62 85 Q 75 70 80 50 Q 82 40 78 30" stroke={c} strokeWidth="1.5" fill="none"/>
        <ellipse cx="78" cy="35" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(30,78,35)"/>
        <ellipse cx="80" cy="45" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(20,80,45)"/>
        <ellipse cx="79" cy="55" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(10,79,55)"/>
        <ellipse cx="76" cy="65" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(0,76,65)"/>
        <ellipse cx="70" cy="75" rx="4" ry="2" fill={c} opacity="0.5" transform="rotate(-15,70,75)"/>
      </g>
    ),
    oak: (
      <g opacity="0.7">
        <path d="M 38 88 Q 18 65 15 40" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M 15 45 Q 10 40 15 35 Q 20 40 15 45 Z" fill={c} opacity="0.5"/>
        <path d="M 17 55 Q 12 50 17 45 Q 22 50 17 55 Z" fill={c} opacity="0.5"/>
        <path d="M 22 65 Q 17 60 22 55 Q 27 60 22 65 Z" fill={c} opacity="0.5"/>
        <path d="M 30 75 Q 25 70 30 65 Q 35 70 30 75 Z" fill={c} opacity="0.5"/>
        <path d="M 62 88 Q 82 65 85 40" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M 85 45 Q 90 40 85 35 Q 80 40 85 45 Z" fill={c} opacity="0.5"/>
        <path d="M 83 55 Q 88 50 83 45 Q 78 50 83 55 Z" fill={c} opacity="0.5"/>
        <path d="M 78 65 Q 83 60 78 55 Q 73 60 78 65 Z" fill={c} opacity="0.5"/>
        <path d="M 70 75 Q 75 70 70 65 Q 65 70 70 75 Z" fill={c} opacity="0.5"/>
      </g>
    ),
    olive: (
      <g opacity="0.65">
        <path d="M 40 86 Q 22 68 18 42" stroke={c} strokeWidth="1.2" fill="none"/>
        <ellipse cx="19" cy="47" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(-15,19,47)"/>
        <ellipse cx="22" cy="57" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(-5,22,57)"/>
        <ellipse cx="28" cy="67" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(5,28,67)"/>
        <ellipse cx="34" cy="77" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(10,34,77)"/>
        <path d="M 60 86 Q 78 68 82 42" stroke={c} strokeWidth="1.2" fill="none"/>
        <ellipse cx="81" cy="47" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(15,81,47)"/>
        <ellipse cx="78" cy="57" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(5,78,57)"/>
        <ellipse cx="72" cy="67" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(-5,72,67)"/>
        <ellipse cx="66" cy="77" rx="3" ry="5" fill={c} opacity="0.4" transform="rotate(-10,66,77)"/>
      </g>
    ),
    roses: (
      <g opacity="0.7">
        <circle cx="15" cy="50" r="4" fill={c} opacity="0.4"/><circle cx="15" cy="50" r="2" fill={c} opacity="0.6"/>
        <circle cx="20" cy="65" r="4" fill={c} opacity="0.4"/><circle cx="20" cy="65" r="2" fill={c} opacity="0.6"/>
        <circle cx="30" cy="78" r="4" fill={c} opacity="0.4"/><circle cx="30" cy="78" r="2" fill={c} opacity="0.6"/>
        <circle cx="85" cy="50" r="4" fill={c} opacity="0.4"/><circle cx="85" cy="50" r="2" fill={c} opacity="0.6"/>
        <circle cx="80" cy="65" r="4" fill={c} opacity="0.4"/><circle cx="80" cy="65" r="2" fill={c} opacity="0.6"/>
        <circle cx="70" cy="78" r="4" fill={c} opacity="0.4"/><circle cx="70" cy="78" r="2" fill={c} opacity="0.6"/>
        <path d="M 38 86 Q 20 70 15 50" stroke={c} strokeWidth="1" fill="none" opacity="0.4"/>
        <path d="M 62 86 Q 80 70 85 50" stroke={c} strokeWidth="1" fill="none" opacity="0.4"/>
      </g>
    ),
    ribbon: (
      <g opacity="0.6">
        <path d="M 10 82 Q 25 88 50 85 Q 75 88 90 82" stroke={c} strokeWidth="2.5" fill="none"/>
        <path d="M 10 82 L 5 90 L 15 86" fill={c} opacity="0.5"/>
        <path d="M 90 82 L 95 90 L 85 86" fill={c} opacity="0.5"/>
      </g>
    ),
    swords: (
      <g opacity="0.6">
        <line x1="12" y1="85" x2="35" y2="20" stroke={c} strokeWidth="2"/>
        <line x1="30" y1="25" x2="40" y2="25" stroke={c} strokeWidth="2"/>
        <line x1="88" y1="85" x2="65" y2="20" stroke={c} strokeWidth="2"/>
        <line x1="60" y1="25" x2="70" y2="25" stroke={c} strokeWidth="2"/>
      </g>
    ),
    wings: (
      <g opacity="0.55">
        <path d="M 42 20 Q 25 10 8 15 Q 15 25 20 18 Q 18 28 12 22 Q 18 35 30 28 Q 25 35 35 30" fill={c}/>
        <path d="M 58 20 Q 75 10 92 15 Q 85 25 80 18 Q 82 28 88 22 Q 82 35 70 28 Q 75 35 65 30" fill={c}/>
      </g>
    ),
  };
  return flourishSvg[type] || null;
}

/* ─────────────── Component ─────────────── */

export function ShieldBuilder({ config, familyName, onChange }: Props) {
  const t = useTranslations('Onboarding');
  const currentShape = SHAPES.find(s => s.value === config.shape) || SHAPES[0];
  const currentDivision = DIVISIONS.find(d => d.value === config.division) || DIVISIONS[0];
  const currentSymbol = CENTER_SYMBOLS.find(s => s.value === config.center_symbol);
  const currentCrest = CREST_ANIMALS.find(a => a.value === config.crest_animal);

  const font = FONT_MAP[config.font_style] || FONT_MAP.serif;

  /* Randomise handler */
  const handleRandomise = useCallback(() => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickNonNone = <T extends { value: string }>(arr: T[]): T => {
      const filtered = arr.filter(i => i.value !== 'none');
      return pick(filtered);
    };

    const words = familyName.trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 3).map(w => w[0]?.toUpperCase() || '').join('');

    onChange({
      ...config,
      initials: initials || config.initials,
      shape: pick(SHAPES).value,
      primary_color: pick(PRIMARY_COLORS).value,
      secondary_color: pick(SECONDARY_COLORS).value,
      accent_color: pick(SECONDARY_COLORS).value,
      division: pick(DIVISIONS).value,
      crest_animal: pickNonNone(CREST_ANIMALS).value,
      flourish: pick(FLOURISHES).value,
      center_symbol: pickNonNone(CENTER_SYMBOLS).value,
      font_style: pick(['serif', 'sans', 'script']),
    });
  }, [config, familyName, onChange]);

  /* Picker helper */
  const toggleBtn = (active: boolean) =>
    `transition-all ${active ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`;

  /* Compute where to place motto + name */
  const hasMottoOrName = config.motto || familyName;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">{t('shieldLabel')}</label>
        <button
          type="button"
          onClick={handleRandomise}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
        >
          <Shuffle className="w-3.5 h-3.5" /> {t('shieldRandom')}
        </button>
      </div>

      {/* ══════════════ Preview ══════════════ */}
      <div className="flex justify-center py-4">
        <svg viewBox="-10 -18 120 140" width="280" height="320" className="drop-shadow-xl">
          <defs>
            <clipPath id="shieldClip">
              <path d={currentShape.path} />
            </clipPath>
          </defs>

          {/* Flourishes (behind shield) */}
          {renderFlourish(config.flourish, config.accent_color)}

          {/* Shield base */}
          <path d={currentShape.path} fill={config.primary_color} stroke={config.accent_color} strokeWidth="2.5" />

          {/* Division */}
          {currentDivision.render(config.primary_color, config.secondary_color, currentShape.path)}

          {/* Border accent */}
          <path d={currentShape.path} fill="none" stroke={config.accent_color} strokeWidth="1.5" opacity="0.5"
                transform="scale(0.9) translate(5.5, 5.5)" />

          {/* Center Symbol */}
          {currentSymbol && currentSymbol.path && (
            <g transform="translate(50, 42)">
              <path d={currentSymbol.path} fill={config.accent_color} opacity="0.85" />
            </g>
          )}

          {/* Initials */}
          {config.initials && (
            <text
              x="50" y={currentSymbol && currentSymbol.path ? 62 : 50}
              textAnchor="middle" dominantBaseline="middle"
              fill={config.accent_color} fontFamily={font}
              fontSize={config.initials.length > 2 ? '10' : '13'}
              fontWeight="bold" opacity="0.9"
            >
              {config.initials}
            </text>
          )}

          {/* Crest Animal (above shield) */}
          {currentCrest && currentCrest.svg && (
            <g transform="translate(50, -6) scale(1.3)">
              <path d={currentCrest.svg} fill={config.accent_color} opacity="0.8" />
            </g>
          )}

          {/* Motto ribbon */}
          {config.motto && (
            <g>
              <rect x="5" y="99" width="90" height="11" rx="2" fill={config.primary_color} stroke={config.accent_color} strokeWidth="0.8" opacity="0.9"/>
              <text x="50" y="106" textAnchor="middle" dominantBaseline="middle"
                    fill={config.accent_color} fontFamily={font} fontSize="4.5" fontStyle="italic" fontWeight="600" opacity="0.9">
                {config.motto.length > 35 ? config.motto.slice(0, 35) + '…' : config.motto}
              </text>
            </g>
          )}

          {/* Family Name */}
          {familyName && (
            <text x="50" y={config.motto ? 117 : 106} textAnchor="middle" dominantBaseline="middle"
                  fill={config.accent_color} fontFamily={font} fontSize="5" fontWeight="bold" letterSpacing="1" opacity="0.7">
              {familyName.toUpperCase().slice(0, 30)}
            </text>
          )}
        </svg>
      </div>

      {/* ══════════════ Controls ══════════════ */}
      <div className="space-y-5">

        {/* ── Shape ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldShape')}</p>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map(s => (
              <button key={s.value} type="button" onClick={() => onChange({ ...config, shape: s.value })}
                className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${toggleBtn(config.shape === s.value)}`} title={s.label}>
                <svg viewBox="0 0 100 100" width="26" height="26"><path d={s.path} fill={config.shape === s.value ? '#6366f1' : '#94a3b8'} /></svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Primary Colour ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldPrimary')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRIMARY_COLORS.map(c => (
              <button key={c.value} type="button" onClick={() => onChange({ ...config, primary_color: c.value })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.primary_color === c.value ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.value }} title={c.label} />
            ))}
            <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 cursor-pointer overflow-hidden hover:border-primary transition-colors" title="Custom">
              <input type="color" value={config.primary_color} onChange={e => onChange({ ...config, primary_color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">+</span>
            </label>
          </div>
        </div>

        {/* ── Secondary Colour ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldSecondary')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {SECONDARY_COLORS.map(c => (
              <button key={c.value} type="button" onClick={() => onChange({ ...config, secondary_color: c.value })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.secondary_color === c.value ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.value }} title={c.label} />
            ))}
            <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 cursor-pointer overflow-hidden hover:border-primary transition-colors" title="Custom">
              <input type="color" value={config.secondary_color} onChange={e => onChange({ ...config, secondary_color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">+</span>
            </label>
          </div>
        </div>

        {/* ── Division ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldDivision')}</p>
          <div className="flex flex-wrap gap-2">
            {DIVISIONS.map(d => (
              <button key={d.value} type="button" onClick={() => onChange({ ...config, division: d.value })}
                className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${toggleBtn(config.division === d.value)}`} title={d.label}>
                <svg viewBox="0 0 100 100" width="24" height="24">
                  <defs><clipPath id={`divPrev_${d.value}`}><path d={SHAPES[0].path}/></clipPath></defs>
                  <path d={SHAPES[0].path} fill="#94a3b8" />
                  <g clipPath={`url(#divPrev_${d.value})`}>{d.render('#94a3b8', '#cbd5e1', SHAPES[0].path)}</g>
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Crest Animal ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldCrest')}</p>
          <div className="flex flex-wrap gap-2">
            {CREST_ANIMALS.map(a => (
              <button key={a.value} type="button" onClick={() => onChange({ ...config, crest_animal: a.value })}
                className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium ${toggleBtn(config.crest_animal === a.value)}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Flourish ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldFlourish')}</p>
          <div className="flex flex-wrap gap-2">
            {FLOURISHES.map(f => (
              <button key={f.value} type="button" onClick={() => onChange({ ...config, flourish: f.value })}
                className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium ${toggleBtn(config.flourish === f.value)}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Center Symbol ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldSymbol')}</p>
          <div className="flex flex-wrap gap-2">
            {CENTER_SYMBOLS.map(s => (
              <button key={s.value} type="button" onClick={() => onChange({ ...config, center_symbol: s.value })}
                className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium ${toggleBtn(config.center_symbol === s.value)}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Motto ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldMotto')}</p>
          <input
            type="text"
            value={config.motto}
            onChange={e => onChange({ ...config, motto: e.target.value })}
            placeholder="Gloria in excelsis Deo"
            maxLength={60}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm italic"
          />
        </div>

        {/* ── Font Style ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldFont')}</p>
          <div className="flex gap-2">
            {(['serif', 'sans', 'script'] as const).map(f => (
              <button key={f} type="button" onClick={() => onChange({ ...config, font_style: f })}
                className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium ${toggleBtn(config.font_style === f)}`}
                style={{ fontFamily: FONT_MAP[f] }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{t('shieldHelp')}</p>
    </div>
  );
}
