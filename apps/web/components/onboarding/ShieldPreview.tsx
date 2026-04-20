'use client';

import React from 'react';
import type { ShieldConfig } from './ShieldBuilder';
import { renderFlourish } from './ShieldBuilder';

interface ShieldPreviewProps {
  config: ShieldConfig;
  familyName: string;
  /** When false, the motto ribbon and family name text are hidden (useful for small/thumbnail display). Defaults to true. */
  showMotto?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

/* ─── Shape paths ─── */
const SHAPE_PATHS: Record<string, string> = {
  heater: 'M 50 8 L 92 24 L 92 55 Q 92 88 50 96 Q 8 88 8 55 L 8 24 Z',
  rounded: 'M 50 8 Q 92 8 92 30 L 92 60 Q 92 92 50 96 Q 8 92 8 60 L 8 30 Q 8 8 50 8 Z',
  kite: 'M 50 4 L 90 30 L 90 65 L 50 98 L 10 65 L 10 30 Z',
  swiss: 'M 50 6 C 80 6 92 18 92 30 L 92 58 C 92 80 72 94 50 96 C 28 94 8 80 8 58 L 8 30 C 8 18 20 6 50 6 Z',
  french: 'M 50 6 L 92 6 L 92 60 Q 92 92 50 96 Q 8 92 8 60 L 8 6 Z',
  polish: 'M 50 4 Q 75 4 88 14 Q 96 22 94 36 L 90 65 Q 85 85 50 96 Q 15 85 10 65 L 6 36 Q 4 22 12 14 Q 25 4 50 4 Z',
  lozenge: 'M 50 4 L 94 50 L 50 96 L 6 50 Z',
  oval: 'M 50 6 C 82 6 92 26 92 50 C 92 74 82 94 50 94 C 18 94 8 74 8 50 C 8 26 18 6 50 6 Z',
};

/* ─── Center symbol paths ─── */
const SYMBOL_PATHS: Record<string, string> = {
  cross: 'M-2,-8 L2,-8 L2,-2 L8,-2 L8,2 L2,2 L2,8 L-2,8 L-2,2 L-8,2 L-8,-2 L-2,-2 Z',
  star: 'M0,-8 L2.4,-2.6 L8,-2.6 L3.6,1.6 L5.6,8 L0,4 L-5.6,8 L-3.6,1.6 L-8,-2.6 L-2.4,-2.6 Z',
  fleur: 'M0,-9 C2,-7 4,-4 3,-1 C6,-3 8,-3 8,0 C8,3 5,4 3,3 C4,6 2,9 0,9 C-2,9 -4,6 -3,3 C-5,4 -8,3 -8,0 C-8,-3 -6,-3 -3,-1 C-4,-4 -2,-7 0,-9 Z',
  eagle: 'M0,-8 L3,-5 L8,-6 L5,-2 L8,2 L4,1 L2,5 L0,3 L-2,5 L-4,1 L-8,2 L-5,-2 L-8,-6 L-3,-5 Z',
  shield_mini: 'M0,-7 L7,-3 L7,2 Q7,7 0,8 Q-7,7 -7,2 L-7,-3 Z',
  circle: 'M0,-6 A6,6 0 1,1 0,6 A6,6 0 1,1 0,-6 Z',
  diamond: 'M0,-8 L6,0 L0,8 L-6,0 Z',
  crescent: 'M-6,4 A7,7 0 1,1 6,4 A5,5 0 1,0 -6,4 Z',
  heart: 'M0,7 C-8,0 -8,-5 -4,-7 C-1,-8 0,-5 0,-5 C0,-5 1,-8 4,-7 C8,-5 8,0 0,7 Z',
  sun: 'M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 Z M0,-9 L1,-6 L-1,-6 Z M0,9 L1,6 L-1,6 Z M-9,0 L-6,1 L-6,-1 Z M9,0 L6,1 L6,-1 Z M-6.4,-6.4 L-4.5,-4.5 L-5.5,-3.5 Z M6.4,6.4 L4.5,4.5 L5.5,3.5 Z M6.4,-6.4 L4.5,-4.5 L5.5,-3.5 Z M-6.4,6.4 L-4.5,4.5 L-5.5,3.5 Z',
  clover: 'M -3,-3.2 A 3,3 0 1,1 3,-3.2 A 3,3 0 1,1 -3,-3.2 Z M -5.77,1.6 A 3,3 0 1,1 0.23,1.6 A 3,3 0 1,1 -5.77,1.6 Z M -0.23,1.6 A 3,3 0 1,1 5.77,1.6 A 3,3 0 1,1 -0.23,1.6 Z M -1,4.5 L 1,4.5 L 1.5,9 L -1.5,9 Z',
  crown: 'M -7,4 L -7,-1 L -5,-1 L -5,-6 L -3,-6 L -3,-1 L -1,-1 L -1,-8 L 1,-8 L 1,-1 L 3,-1 L 3,-6 L 5,-6 L 5,-1 L 7,-1 L 7,4 Z M -8,4 L 8,4 L 7,7 L -7,7 Z',
  sword: 'M 0,-9 L 1.2,1 L -1.2,1 Z M -6,1 L 6,1 L 6,2.8 L -6,2.8 Z M -1,2.8 L 1,2.8 L 1,6.5 L -1,6.5 Z M 0,6.5 L 2.5,8 L 0,9.5 L -2.5,8 Z',
  chalice: 'M -6,-7 L 6,-7 L 4,1 L -4,1 Z M -1,1 L 1,1 L 1,5.5 L -1,5.5 Z M -5.5,5.5 L 5.5,5.5 L 5.5,8 L -5.5,8 Z',
  tower: 'M -5,8 L -5,1 L -3.5,1 L -3.5,-5 L -2,-5 L -2,-8 L -0.5,-8 L -0.5,-5 L 0.5,-5 L 0.5,-8 L 2,-8 L 2,-5 L 3.5,-5 L 3.5,1 L 5,1 L 5,8 Z M -1.5,3 L 1.5,3 L 1.5,8 L -1.5,8 Z',
  anchor: 'M -2,-7 A 2,2 0 1,1 2,-7 A 2,2 0 1,1 -2,-7 Z M -0.8,-5 L 0.8,-5 L 0.8,5 L -0.8,5 Z M -5,-3 L 5,-3 L 5,-1.5 L -5,-1.5 Z M -0.8,5 L -5,8 L -6,5 L -2,4 Z M 0.8,5 L 5,8 L 6,5 L 2,4 Z',
  key: 'M -3,-5 A 3,3 0 1,1 3,-5 A 3,3 0 1,1 -3,-5 Z M -0.8,-2 L 0.8,-2 L 0.8,8 L -0.8,8 Z M 0.8,1 L 3.5,1 L 3.5,2.8 L 0.8,2.8 Z M 0.8,4.5 L 3.5,4.5 L 3.5,6.3 L 0.8,6.3 Z',
  compass: 'M 0,-9 L 2,-4 L -2,-4 Z M 0,9 L 2,4 L -2,4 Z M -9,0 L -4,2 L -4,-2 Z M 9,0 L 4,2 L 4,-2 Z M 6.4,-6.4 L 2,-2.8 L 4.2,-0.6 Z M -6.4,6.4 L -2,2.8 L -4.2,0.6 Z M -6.4,-6.4 L -2,-2.8 L -4.2,-0.6 Z M 6.4,6.4 L 2,2.8 L 4.2,0.6 Z M 0,-2 A 2,2 0 1,1 0,2 A 2,2 0 1,1 0,-2 Z',
  book: 'M 0,-7 L 0,7 L -7.5,5.5 L -7.5,-5.5 Z M 0,-7 L 0,7 L 7.5,5.5 L 7.5,-5.5 Z M -0.8,-7 L 0.8,-7 L 0.8,7 L -0.8,7 Z',
  trident: 'M -0.8,-9 L 0.8,-9 L 0.8,2 L -0.8,2 Z M -4.5,-9 L -3,-9 L -3,-3 L -4.5,-3 Z M 3,-9 L 4.5,-9 L 4.5,-3 L 3,-3 Z M -4.5,-3 L 4.5,-3 L 4.5,-1.5 L -4.5,-1.5 Z M -0.8,2 L 0.8,2 L 0.8,9 L -0.8,9 Z',
};

/* ─── Crest animal paths ─── */
const CREST_PATHS: Record<string, string> = {
  crown_imperial: 'M -8,4 L -8,-1 L -6,-5 L -4,-1 L -2,-7 L 0,-3 L 2,-7 L 4,-1 L 6,-5 L 8,-1 L 8,4 Z M -8,4 L 8,4 L 7,7 L -7,7 Z',
  star_6: 'M 0,-8 L 2.3,-3.5 L 7,-3.5 L 3.5,0 L 5.5,5 L 0,2.5 L -5.5,5 L -3.5,0 L -7,-3.5 L -2.3,-3.5 Z M 0,8 L -2.3,3.5 L -7,3.5 L -3.5,0 L -5.5,-5 L 0,-2.5 L 5.5,-5 L 3.5,0 L 7,3.5 L 2.3,3.5 Z',
  star_8: 'M 0,-8 L 1.5,-3 L 5.6,-5.6 L 3,-1.5 L 8,0 L 3,1.5 L 5.6,5.6 L 1.5,3 L 0,8 L -1.5,3 L -5.6,5.6 L -3,1.5 L -8,0 L -3,-1.5 L -5.6,-5.6 L -1.5,-3 Z',
  fleur_de_lis: 'M 0,-9 C 1,-7 3,-5 2,-2 C 4,-4 7,-4 7,-1 C 7,2 4,3 2,2 C 3,5 1,8 0,8 C -1,8 -3,5 -2,2 C -4,3 -7,2 -7,-1 C -7,-4 -4,-4 -2,-2 C -3,-5 -1,-7 0,-9 Z M -3,5 L 3,5 L 2,7 L -2,7 Z',
  helm: 'M -7,8 L -7,0 C -7,-5 -4,-9 0,-9 C 4,-9 7,-5 7,0 L 7,8 L 5,9 L -5,9 Z M -7,0 L 7,0 L 7,2 L -7,2 Z M -5,4 L 5,4 L 5,6 L -5,6 Z',
  sunburst: 'M 0,-4 A 4,4 0 1,1 0,4 A 4,4 0 1,1 0,-4 Z M 0,-9 L 0.8,-6 L -0.8,-6 Z M 0,9 L 0.8,6 L -0.8,6 Z M -9,0 L -6,0.8 L -6,-0.8 Z M 9,0 L 6,0.8 L 6,-0.8 Z M -6.4,-6.4 L -4.2,-4.2 L -5.2,-3.2 Z M 6.4,6.4 L 4.2,4.2 L 5.2,3.2 Z M 6.4,-6.4 L 4.2,-4.2 L 5.2,-3.2 Z M -6.4,6.4 L -4.2,4.2 L -5.2,3.2 Z',
  double_eagle: 'M 0,-2 L -4,-5 L -8,-4 L -6,-1 L -9,2 L -5,1 L -3,5 L 0,3 L 3,5 L 5,1 L 9,2 L 6,-1 L 8,-4 L 4,-5 Z M -2,-2 L -2,-6 L 0,-8 L 2,-6 L 2,-2 Z',
  crescent_moon: 'M 5,4.9 A 7,7 0 1,0 5,-4.9 A 5.5,5.5 0 0,1 5,4.9 Z',
  winged_crown: 'M -5,7 L -5,1 L -9,-3 L -7,-1 L -5,-6 L -3,-1 L 0,-9 L 3,-1 L 5,-6 L 7,-1 L 9,-3 L 5,1 L 5,7 Z M -6,7 L 6,7 L 5,9 L -5,9 Z',
  tudor_rose: 'M 0,-7 L 1.15,-2.77 L 4.95,-4.95 L 2.77,-1.15 L 7,0 L 2.77,1.15 L 4.95,4.95 L 1.15,2.77 L 0,7 L -1.15,2.77 L -4.95,4.95 L -2.77,1.15 L -7,0 L -2.77,-1.15 L -4.95,-4.95 L -1.15,-2.77 Z',
  mural_crown: 'M -9,7 L -9,1 L -7,1 L -7,-3 L -5,-3 L -5,1 L -1,1 L -1,-5 L 1,-5 L 1,1 L 5,1 L 5,-3 L 7,-3 L 7,1 L 9,1 L 9,7 Z',
  cinquefoil: 'M -2.5,-4 A 2.5,2.5 0 1,1 2.5,-4 A 2.5,2.5 0 1,1 -2.5,-4 Z M 1.3,-1.24 A 2.5,2.5 0 1,1 6.3,-1.24 A 2.5,2.5 0 1,1 1.3,-1.24 Z M -0.15,3.24 A 2.5,2.5 0 1,1 4.85,3.24 A 2.5,2.5 0 1,1 -0.15,3.24 Z M -4.85,3.24 A 2.5,2.5 0 1,1 0.15,3.24 A 2.5,2.5 0 1,1 -4.85,3.24 Z M -6.3,-1.24 A 2.5,2.5 0 1,1 -1.3,-1.24 A 2.5,2.5 0 1,1 -6.3,-1.24 Z',
  maltese_cross: 'M -1,-9 L 1,-9 L 2.5,-6 L 2.5,-2.5 L 6,-2.5 L 9,-1 L 9,1 L 6,2.5 L 2.5,2.5 L 2.5,6 L 1,9 L -1,9 L -2.5,6 L -2.5,2.5 L -6,2.5 L -9,1 L -9,-1 L -6,-2.5 L -2.5,-2.5 L -2.5,-6 Z',
};

const FONT_MAP: Record<string, string> = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "'Inter', 'Helvetica Neue', sans-serif",
  script: "'Brush Script MT', 'Segoe Script', cursive",
  gothic: "'Copperplate', 'Copperplate Gothic Light', fantasy",
  classic: "'Palatino Linotype', 'Book Antiqua', 'Palatino', serif",
};

/* ─── Pattern definition helper ─── */
function getPatternDef(type: string, color: string, id: string): JSX.Element | null {
  if (type === 'none') return null;
  switch (type) {
    case 'chess':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="10">
          <rect width="5" height="5" fill={color} /><rect x="5" y="5" width="5" height="5" fill={color} />
        </pattern>
      );
    case 'stripes_h':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="8">
          <rect width="10" height="4" fill={color} />
        </pattern>
      );
    case 'stripes_v':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="10">
          <rect width="4" height="10" fill={color} />
        </pattern>
      );
    case 'stripes_d':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
          <rect width="5" height="10" fill={color} />
        </pattern>
      );
    case 'dots':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="12" height="12">
          <circle cx="6" cy="6" r="3" fill={color} />
        </pattern>
      );
    case 'diamonds':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="14" height="14">
          <path d="M7,1 L13,7 L7,13 L1,7 Z" fill={color} />
        </pattern>
      );
    case 'stars':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="18" height="18">
          <path d="M9,3 L10.5,7 L15,7 L11.5,9.5 L12.8,14 L9,11 L5.2,14 L6.5,9.5 L3,7 L7.5,7 Z" fill={color} />
        </pattern>
      );
    case 'crosses':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16">
          <path d="M6,2 L10,2 L10,6 L14,6 L14,10 L10,10 L10,14 L6,14 L6,10 L2,10 L2,6 L6,6 Z" fill={color} />
        </pattern>
      );
    case 'leaves':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="20">
          <path d="M8,2 C12,6 14,14 8,18 C2,14 4,6 8,2 Z" fill={color} />
        </pattern>
      );
    case 'scales':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="12" height="10">
          <path d="M0,10 C0,4 6,0 6,0 C6,0 12,4 12,10" fill="none" stroke={color} strokeWidth="2" />
        </pattern>
      );
    case 'waves':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="20" height="10">
          <path d="M0,5 C5,0 10,0 10,5 C10,10 15,10 20,5" fill="none" stroke={color} strokeWidth="2" />
        </pattern>
      );
    case 'fleur':
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="20" height="20">
          <path d="M10,4 C11,5 12,7 11.5,9 C13,7.5 15,7.5 15,9 C15,10.5 13,11 11.5,10.5 C12,12.5 11,15 10,15 C9,15 8,12.5 8.5,10.5 C7,11 5,10.5 5,9 C5,7.5 7,7.5 8.5,9 C8,7 9,5 10,4 Z" fill={color} />
        </pattern>
      );
    default:
      return null;
  }
}

/**
 * Standalone shield preview component.
 * Renders the shield SVG from a ShieldConfig.
 * Pass `showMotto={false}` for small/thumbnail displays (hides motto ribbon and family name).
 */
export function ShieldPreview({
  config,
  familyName,
  showMotto = true,
  width = 280,
  height = 320,
  className = '',
}: ShieldPreviewProps) {
  const shapePath = SHAPE_PATHS[config.shape] || SHAPE_PATHS.heater;
  const symbolPath = config.center_symbol !== 'none' ? SYMBOL_PATHS[config.center_symbol] : undefined;
  const crestPath = config.crest_animal !== 'none' ? CREST_PATHS[config.crest_animal] : undefined;
  const font = FONT_MAP[config.font_style] || FONT_MAP.serif;

  return (
    <svg viewBox="-10 -18 120 140" width={width} height={height} className={className}>
      <defs>
        <clipPath id="previewClip">
          <path d={shapePath} />
        </clipPath>
        {config.division !== 'none' && getPatternDef(config.division, config.secondary_color, 'previewPattern')}
      </defs>

      {/* Shield base */}
      <path d={shapePath} fill={config.primary_color} stroke={config.accent_color} strokeWidth="2.5" />

      {/* Shield Pattern */}
      {config.division !== 'none' && (
        <rect x="0" y="0" width="100" height="100" fill="url(#previewPattern)" clipPath="url(#previewClip)" opacity="0.35" />
      )}

      {/* Border accent */}
      <path d={shapePath} fill="none" stroke={config.accent_color} strokeWidth="1.5" opacity="0.5"
        transform="scale(0.9) translate(5.5, 5.5)" />

      {/* Flourishes (around shield) */}
      {config.flourish && config.flourish !== 'none' && renderFlourish(config.flourish, config.accent_color)}

      {/* Center Symbol */}
      {symbolPath && (
        <g transform="translate(50, 42)">
          <path d={symbolPath} fill={config.symbol_color} opacity="0.85" />
        </g>
      )}

      {/* Initials */}
      {config.initials && (
        <text
          x="50" y={symbolPath ? 62 : 50}
          textAnchor="middle" dominantBaseline="middle"
          fill={config.symbol_color} fontFamily={font}
          fontSize={config.initials.length > 2 ? '10' : '13'}
          fontWeight="bold" opacity="0.9"
        >
          {config.initials}
        </text>
      )}

      {/* Crest Animal (above shield) */}
      {crestPath && (
        <g transform="translate(50, -6) scale(1.3)">
          <path d={crestPath} fill={config.accent_color} opacity="0.8" />
        </g>
      )}

      {/* Motto ribbon — only when showMotto is true */}
      {showMotto && config.motto && (
        <g>
          <rect x="5" y="99" width="90" height="11" rx="2" fill={config.primary_color} stroke={config.accent_color} strokeWidth="0.8" opacity="0.9" />
          <text x="50" y="106" textAnchor="middle" dominantBaseline="middle"
            fill={config.accent_color} fontFamily={font} fontSize="4.5" fontStyle="italic" fontWeight="600" opacity="0.9">
            {config.motto.length > 35 ? config.motto.slice(0, 35) + '\u2026' : config.motto}
          </text>
        </g>
      )}

      {/* Family Name — only when showMotto is true */}
      {showMotto && familyName && (
        <text x="50" y={config.motto ? 117 : 106} textAnchor="middle" dominantBaseline="middle"
          fill={config.accent_color} fontFamily={font} fontSize="5" fontWeight="bold" letterSpacing="1" opacity="0.7">
          {familyName.toUpperCase().slice(0, 30)}
        </text>
      )}
    </svg>
  );
}
