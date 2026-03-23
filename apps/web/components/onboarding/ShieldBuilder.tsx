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
  symbol_color: string;
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

const DETAIL_COLORS = [
  { value: '#1C1C1C', label: 'Sable' },
  { value: '#2C2C2C', label: 'Charcoal' },
  { value: '#3D1C00', label: 'Dark Brown' },
  { value: '#1B2A4A', label: 'Dark Blue' },
  { value: '#0D3B2F', label: 'Dark Green' },
  { value: '#2B1055', label: 'Dark Purple' },
  { value: '#4A0E0E', label: 'Dark Red' },
  { value: '#2F4F4F', label: 'Dark Teal' },
  { value: '#191970', label: 'Midnight' },
  { value: '#3B3B3B', label: 'Graphite' },
];

const PATTERNS: { value: string; label: string }[] = [
  { value: 'none', label: 'Plain' },
  { value: 'chess', label: 'Checkerboard' },
  { value: 'stripes_h', label: 'Horizontal Stripes' },
  { value: 'stripes_v', label: 'Vertical Stripes' },
  { value: 'stripes_d', label: 'Diagonal Stripes' },
  { value: 'dots', label: 'Polka Dots' },
  { value: 'diamonds', label: 'Diamonds' },
  { value: 'stars', label: 'Stars' },
  { value: 'crosses', label: 'Crosses' },
  { value: 'leaves', label: 'Leaves' },
  { value: 'scales', label: 'Scales' },
  { value: 'waves', label: 'Waves' },
  { value: 'fleur', label: 'Fleur-de-lis' },
];

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

/* SVG path definitions for center symbols — 20x20 centered at origin */
const CENTER_SYMBOLS: { value: string; label: string; path: string }[] = [
  { value: 'none', label: 'None', path: '' },

  /* ── EXISTING (unchanged) ────────────────────────────────────────────────── */

  {
    value: 'cross',
    label: 'Cross',
    path: 'M-2,-8 L2,-8 L2,-2 L8,-2 L8,2 L2,2 L2,8 L-2,8 L-2,2 L-8,2 L-8,-2 L-2,-2 Z',
  },
  {
    value: 'star',
    label: 'Star',
    path: 'M0,-8 L2.4,-2.6 L8,-2.6 L3.6,1.6 L5.6,8 L0,4 L-5.6,8 L-3.6,1.6 L-8,-2.6 L-2.4,-2.6 Z',
  },
  {
    value: 'fleur',
    label: 'Fleur-de-lis',
    path: 'M0,-9 C2,-7 4,-4 3,-1 C6,-3 8,-3 8,0 C8,3 5,4 3,3 C4,6 2,9 0,9 C-2,9 -4,6 -3,3 C-5,4 -8,3 -8,0 C-8,-3 -6,-3 -3,-1 C-4,-4 -2,-7 0,-9 Z',
  },
  {
    value: 'eagle',
    label: 'Eagle',
    path: 'M0,-8 L3,-5 L8,-6 L5,-2 L8,2 L4,1 L2,5 L0,3 L-2,5 L-4,1 L-8,2 L-5,-2 L-8,-6 L-3,-5 Z',
  },
  {
    value: 'shield_mini',
    label: 'Escutcheon',
    path: 'M0,-7 L7,-3 L7,2 Q7,7 0,8 Q-7,7 -7,2 L-7,-3 Z',
  },
  {
    value: 'circle',
    label: 'Roundel',
    path: 'M0,-6 A6,6 0 1,1 0,6 A6,6 0 1,1 0,-6 Z',
  },
  {
    value: 'diamond',
    label: 'Lozenge',
    path: 'M0,-8 L6,0 L0,8 L-6,0 Z',
  },
  {
    value: 'crescent',
    label: 'Crescent',
    path: 'M-6,4 A7,7 0 1,1 6,4 A5,5 0 1,0 -6,4 Z',
  },
  {
    value: 'heart',
    label: 'Heart',
    path: 'M0,7 C-8,0 -8,-5 -4,-7 C-1,-8 0,-5 0,-5 C0,-5 1,-8 4,-7 C8,-5 8,0 0,7 Z',
  },
  {
    value: 'sun',
    label: 'Sun',
    path: 'M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 Z M0,-9 L1,-6 L-1,-6 Z M0,9 L1,6 L-1,6 Z M-9,0 L-6,1 L-6,-1 Z M9,0 L6,1 L6,-1 Z M-6.4,-6.4 L-4.5,-4.5 L-5.5,-3.5 Z M6.4,6.4 L4.5,4.5 L5.5,3.5 Z M6.4,-6.4 L4.5,-4.5 L5.5,-3.5 Z M-6.4,6.4 L-4.5,4.5 L-5.5,3.5 Z',
  },

  /* ── NEW SYMBOLS ─────────────────────────────────────────────────────────── */

  {
    /* Three circles (r=3) whose centres sit at 120° on a ring of r=3.2,
       joined at the origin. Stem is a small closed trapezoid below.
       Each circle uses the two-arc trick: M cx-r,cy A r,r 0 1,1 cx+r,cy A r,r 0 1,1 cx-r,cy Z */
    value: 'clover',
    label: 'Clover',
    path:
      // Top leaf  (centre 0, -3.2)
      'M -3,-3.2 A 3,3 0 1,1 3,-3.2 A 3,3 0 1,1 -3,-3.2 Z ' +
      // Bottom-left leaf  (centre -2.77, 1.6)
      'M -5.77,1.6 A 3,3 0 1,1 0.23,1.6 A 3,3 0 1,1 -5.77,1.6 Z ' +
      // Bottom-right leaf (centre  2.77, 1.6)
      'M -0.23,1.6 A 3,3 0 1,1 5.77,1.6 A 3,3 0 1,1 -0.23,1.6 Z ' +
      // Stem
      'M -1,4.5 L 1,4.5 L 1.5,9 L -1.5,9 Z',
  },

  {
    /* Simple heraldic crown: crenellated top + band base */
    value: 'crown',
    label: 'Crown',
    path:
      // Crown body with three points
      'M -7,4 L -7,-1 L -5,-1 L -5,-6 L -3,-6 L -3,-1 L -1,-1 L -1,-8 L 1,-8 L 1,-1 L 3,-1 L 3,-6 L 5,-6 L 5,-1 L 7,-1 L 7,4 Z ' +
      // Base band
      'M -8,4 L 8,4 L 7,7 L -7,7 Z',
  },

  {
    /* Upward-pointing sword: tapered blade + crossguard + grip + pommel */
    value: 'sword',
    label: 'Sword',
    path:
      // Blade (tapered from tip to guard)
      'M 0,-9 L 1.2,1 L -1.2,1 Z ' +
      // Crossguard
      'M -6,1 L 6,1 L 6,2.8 L -6,2.8 Z ' +
      // Grip
      'M -1,2.8 L 1,2.8 L 1,6.5 L -1,6.5 Z ' +
      // Pommel (rounded diamond)
      'M 0,6.5 L 2.5,8 L 0,9.5 L -2.5,8 Z',
  },

  {
    /* Chalice / goblet: bowl + stem + foot */
    value: 'chalice',
    label: 'Chalice',
    path:
      // Bowl (trapezoid, wide at top)
      'M -6,-7 L 6,-7 L 4,1 L -4,1 Z ' +
      // Stem
      'M -1,1 L 1,1 L 1,5.5 L -1,5.5 Z ' +
      // Foot
      'M -5.5,5.5 L 5.5,5.5 L 5.5,8 L -5.5,8 Z',
  },

  {
    /* Tower / castle keep: walls + three battlements */
    value: 'tower',
    label: 'Tower',
    path:
      // Tower body
      'M -5,8 L -5,1 L -3.5,1 L -3.5,-5 L -2,-5 L -2,-8 L -0.5,-8 L -0.5,-5 L 0.5,-5 L 0.5,-8 L 2,-8 L 2,-5 L 3.5,-5 L 3.5,1 L 5,1 L 5,8 Z ' +
      // Gate arch (filled rectangle; real arch needs clip)
      'M -1.5,3 L 1.5,3 L 1.5,8 L -1.5,8 Z',
  },

  {
    /* Anchor: ring + shaft + stock bar + flukes */
    value: 'anchor',
    label: 'Anchor',
    path:
      // Ring at top (full circle, r=2)
      'M -2,-7 A 2,2 0 1,1 2,-7 A 2,2 0 1,1 -2,-7 Z ' +
      // Shaft
      'M -0.8,-5 L 0.8,-5 L 0.8,5 L -0.8,5 Z ' +
      // Stock (horizontal bar)
      'M -5,-3 L 5,-3 L 5,-1.5 L -5,-1.5 Z ' +
      // Left fluke
      'M -0.8,5 L -5,8 L -6,5 L -2,4 Z ' +
      // Right fluke
      'M 0.8,5 L 5,8 L 6,5 L 2,4 Z',
  },

  {
    /* Key: ring head + shaft + two teeth */
    value: 'key',
    label: 'Key',
    path:
      // Head ring (r=3, centre 0,-5)
      'M -3,-5 A 3,3 0 1,1 3,-5 A 3,3 0 1,1 -3,-5 Z ' +
      // Shaft
      'M -0.8,-2 L 0.8,-2 L 0.8,8 L -0.8,8 Z ' +
      // Top tooth
      'M 0.8,1 L 3.5,1 L 3.5,2.8 L 0.8,2.8 Z ' +
      // Bottom tooth
      'M 0.8,4.5 L 3.5,4.5 L 3.5,6.3 L 0.8,6.3 Z',
  },

  {
    /* Compass rose: 4 large cardinal points + 4 small inter-cardinal points */
    value: 'compass',
    label: 'Compass Rose',
    path:
      // N
      'M 0,-9 L 2,-4 L -2,-4 Z ' +
      // S
      'M 0,9 L 2,4 L -2,4 Z ' +
      // W
      'M -9,0 L -4,2 L -4,-2 Z ' +
      // E
      'M 9,0 L 4,2 L 4,-2 Z ' +
      // NE
      'M 6.4,-6.4 L 2,-2.8 L 4.2,-0.6 Z ' +
      // SW
      'M -6.4,6.4 L -2,2.8 L -4.2,0.6 Z ' +
      // NW
      'M -6.4,-6.4 L -2,-2.8 L -4.2,-0.6 Z ' +
      // SE
      'M 6.4,6.4 L 2,2.8 L 4.2,0.6 Z ' +
      // Centre disc
      'M 0,-2 A 2,2 0 1,1 0,2 A 2,2 0 1,1 0,-2 Z',
  },

  {
    /* Book (open): two pages meeting at the spine */
    value: 'book',
    label: 'Open Book',
    path:
      // Left page
      'M 0,-7 L 0,7 L -7.5,5.5 L -7.5,-5.5 Z ' +
      // Right page
      'M 0,-7 L 0,7 L 7.5,5.5 L 7.5,-5.5 Z ' +
      // Spine ridge
      'M -0.8,-7 L 0.8,-7 L 0.8,7 L -0.8,7 Z',
  },

  {
    /* Trident: three upward prongs + shaft */
    value: 'trident',
    label: 'Trident',
    path:
      // Centre prong (tallest)
      'M -0.8,-9 L 0.8,-9 L 0.8,2 L -0.8,2 Z ' +
      // Left prong
      'M -4.5,-9 L -3,-9 L -3,-3 L -4.5,-3 Z ' +
      // Right prong
      'M 3,-9 L 4.5,-9 L 4.5,-3 L 3,-3 Z ' +
      // Cross bar connecting prongs
      'M -4.5,-3 L 4.5,-3 L 4.5,-1.5 L -4.5,-1.5 Z ' +
      // Shaft below crossbar
      'M -0.8,2 L 0.8,2 L 0.8,9 L -0.8,9 Z',
  },
];

/* Crest animals — SVG paths rendered above the shield, 30x30 centered at origin */
const CREST_ANIMALS: { value: string; label: string; svg: string }[] = [
  { value: 'none', label: 'None', svg: '' },

  /* ── KEPT — already render correctly ──────────────────────────────────────── */

  {
    // Two filled polygons: crown body + band base
    value: 'crown_imperial',
    label: 'Imperial Crown',
    svg: 'M -8,4 L -8,-1 L -6,-5 L -4,-1 L -2,-7 L 0,-3 L 2,-7 L 4,-1 L 6,-5 L 8,-1 L 8,4 Z M -8,4 L 8,4 L 7,7 L -7,7 Z',
  },

  {
    // Two overlapping triangles (compound path — nonzero fill rule fills both)
    value: 'star_6',
    label: 'Star of David',
    svg: 'M 0,-8 L 2.3,-3.5 L 7,-3.5 L 3.5,0 L 5.5,5 L 0,2.5 L -5.5,5 L -3.5,0 L -7,-3.5 L -2.3,-3.5 Z M 0,8 L -2.3,3.5 L -7,3.5 L -3.5,0 L -5.5,-5 L 0,-2.5 L 5.5,-5 L 3.5,0 L 7,3.5 L 2.3,3.5 Z',
  },

  {
    // 16-point closed star polygon
    value: 'star_8',
    label: '8-Point Star',
    svg: 'M 0,-8 L 1.5,-3 L 5.6,-5.6 L 3,-1.5 L 8,0 L 3,1.5 L 5.6,5.6 L 1.5,3 L 0,8 L -1.5,3 L -5.6,5.6 L -3,1.5 L -8,0 L -3,-1.5 L -5.6,-5.6 L -1.5,-3 Z',
  },

  {
    // Bezier petal body + closed base bar
    value: 'fleur_de_lis',
    label: 'Fleur-de-lis',
    svg: 'M 0,-9 C 1,-7 3,-5 2,-2 C 4,-4 7,-4 7,-1 C 7,2 4,3 2,2 C 3,5 1,8 0,8 C -1,8 -3,5 -2,2 C -4,3 -7,2 -7,-1 C -7,-4 -4,-4 -2,-2 C -3,-5 -1,-7 0,-9 Z M -3,5 L 3,5 L 2,7 L -2,7 Z',
  },

  {
    // Knight's great helm — bucket shape with visor slits
    value: 'helm',
    label: 'Heraldic Helm',
    svg: 'M -7,8 L -7,0 C -7,-5 -4,-9 0,-9 C 4,-9 7,-5 7,0 L 7,8 L 5,9 L -5,9 Z M -7,0 L 7,0 L 7,2 L -7,2 Z M -5,4 L 5,4 L 5,6 L -5,6 Z',
  },

  {
    // Filled disc + 8 filled ray triangles
    value: 'sunburst',
    label: 'Sunburst',
    svg: 'M 0,-4 A 4,4 0 1,1 0,4 A 4,4 0 1,1 0,-4 Z M 0,-9 L 0.8,-6 L -0.8,-6 Z M 0,9 L 0.8,6 L -0.8,6 Z M -9,0 L -6,0.8 L -6,-0.8 Z M 9,0 L 6,0.8 L 6,-0.8 Z M -6.4,-6.4 L -4.2,-4.2 L -5.2,-3.2 Z M 6.4,6.4 L 4.2,4.2 L 5.2,3.2 Z M 6.4,-6.4 L 4.2,-4.2 L 5.2,-3.2 Z M -6.4,6.4 L -4.2,4.2 L -5.2,3.2 Z',
  },

  {
    // Wing body polygon + neck/head triangle
    value: 'double_eagle',
    label: 'Double Eagle',
    svg: 'M 0,-2 L -4,-5 L -8,-4 L -6,-1 L -9,2 L -5,1 L -3,5 L 0,3 L 3,5 L 5,1 L 9,2 L 6,-1 L 8,-4 L 4,-5 Z M -2,-2 L -2,-6 L 0,-8 L 2,-6 L 2,-2 Z',
  },

  /* ── NEW REPLACEMENTS — all fully closed, fill-safe ───────────────────────── */

  {
    // Arc math: outer circle r=7 center (0,0); inner circle r=5.5 center (2.5,0).
    // Intersection at x=5, y=±4.9. Large CCW arc sweeps the left "back" of the moon;
    // small CW arc cuts the inner face. Result: left-facing crescent.
    value: 'crescent_moon',
    label: 'Crescent Moon',
    svg: 'M 5,4.9 A 7,7 0 1,0 5,-4.9 A 5.5,5.5 0 0,1 5,4.9 Z',
  },

  {
    // Winged crown — crown body with flared wing-like extensions
    value: 'winged_crown',
    label: 'Winged Crown',
    svg: 'M -5,7 L -5,1 L -9,-3 L -7,-1 L -5,-6 L -3,-1 L 0,-9 L 3,-1 L 5,-6 L 7,-1 L 9,-3 L 5,1 L 5,7 Z M -6,7 L 6,7 L 5,9 L -5,9 Z',
  },

  {
    // 16-point star: alternating outer petals (r=7) and inner notches (r=3).
    // Points computed at 22.5° intervals → classic 8-petal Tudor / heraldic rose shape.
    value: 'tudor_rose',
    label: 'Tudor Rose',
    svg: 'M 0,-7 L 1.15,-2.77 L 4.95,-4.95 L 2.77,-1.15 L 7,0 L 2.77,1.15 L 4.95,4.95 L 1.15,2.77 L 0,7 L -1.15,2.77 L -4.95,4.95 L -2.77,1.15 L -7,0 L -2.77,-1.15 L -4.95,-4.95 L -1.15,-2.77 Z',
  },

  {
    // Battlemented crown silhouette: 3 merlons (left short, centre tall, right short)
    // sitting on a band. Entire shape is one closed polygon.
    value: 'mural_crown',
    label: 'Mural Crown',
    svg: 'M -9,7 L -9,1 L -7,1 L -7,-3 L -5,-3 L -5,1 L -1,1 L -1,-5 L 1,-5 L 1,1 L 5,1 L 5,-3 L 7,-3 L 7,1 L 9,1 L 9,7 Z',
  },

  {
    // Five filled circles arranged in a regular pentagon (r=4 from centre, each circle r=2.5).
    // Each circle is two 180° arcs (the only way to draw a full circle with <path>).
    // Centers: top (0,-4), upper-R (3.80,-1.24), lower-R (2.35,3.24),
    //          lower-L (-2.35,3.24), upper-L (-3.80,-1.24).
    value: 'cinquefoil',
    label: 'Cinquefoil',
    svg:
      'M -2.5,-4   A 2.5,2.5 0 1,1 2.5,-4    A 2.5,2.5 0 1,1 -2.5,-4   Z ' +
      'M  1.3,-1.24 A 2.5,2.5 0 1,1 6.3,-1.24  A 2.5,2.5 0 1,1  1.3,-1.24 Z ' +
      'M -0.15,3.24 A 2.5,2.5 0 1,1 4.85,3.24  A 2.5,2.5 0 1,1 -0.15,3.24 Z ' +
      'M -4.85,3.24 A 2.5,2.5 0 1,1 0.15,3.24  A 2.5,2.5 0 1,1 -4.85,3.24 Z ' +
      'M -6.3,-1.24 A 2.5,2.5 0 1,1 -1.3,-1.24 A 2.5,2.5 0 1,1 -6.3,-1.24 Z',
  },

  {
    // 20-point polygon: flat-tipped arms (width=2) with concave square notches
    // at 45° corners — the defining trait of the Maltese cross.
    value: 'maltese_cross',
    label: 'Maltese Cross',
    svg: 'M -1,-9 L 1,-9 L 2.5,-6 L 2.5,-2.5 L 6,-2.5 L 9,-1 L 9,1 L 6,2.5 L 2.5,2.5 L 2.5,6 L 1,9 L -1,9 L -2.5,6 L -2.5,2.5 L -6,2.5 L -9,1 L -9,-1 L -6,-2.5 L -2.5,-2.5 L -2.5,-6 Z',
  },
];

/* Flourish patterns — decorative elements around the shield */
const FLOURISHES: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'laurel', label: 'Laurel Wreath' },
  { value: 'oak', label: 'Oak Branches' },
  { value: 'scrolls', label: 'Scrolls' },
  { value: 'roses', label: 'Roses' },
  { value: 'ribbon', label: 'Ribbon' },
  { value: 'crossed_swords', label: 'Crossed Swords' },
  { value: 'wings', label: 'Wings' },
  { value: 'torches', label: 'Torches' },
  { value: 'spears', label: 'Spears' },
  { value: 'axes', label: 'Battle Axes' },
  { value: 'vines', label: 'Vines' },
  { value: 'candles', label: 'Candles' },
  { value: 'banners', label: 'Banners' },
];

const FONT_MAP: Record<string, string> = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "'Inter', 'Helvetica Neue', sans-serif",
  script: "'Brush Script MT', 'Segoe Script', cursive",
  gothic: "'Copperplate', 'Copperplate Gothic Light', fantasy",
  classic: "'Palatino Linotype', 'Book Antiqua', 'Palatino', serif",
};


/* ─────────────── Flourish Renderer ─────────────── */

function renderFlourish(type: string, color: string): JSX.Element | null {
  if (type === 'none') return null;
  const c = color;

  const flourishSvg: Record<string, JSX.Element> = {

    /* ── LAUREL ────────────────────────────────────────────────────────────── */
    laurel: (
      <g fill={c} opacity="0.85">
        <rect x="3.5" y="24" width="1.2" height="64" rx="0.6" />
        <ellipse cx="0.5" cy="33" rx="4.5" ry="2" transform="rotate(-40 0.5 33)" />
        <ellipse cx="6.5" cy="41" rx="4.5" ry="2" transform="rotate( 35 6.5 41)" />
        <ellipse cx="0.5" cy="50" rx="4.5" ry="2" transform="rotate(-38 0.5 50)" />
        <ellipse cx="6.5" cy="58" rx="4.5" ry="2" transform="rotate( 35 6.5 58)" />
        <ellipse cx="0.5" cy="66" rx="4.5" ry="2" transform="rotate(-35 0.5 66)" />
        <ellipse cx="6.5" cy="74" rx="4.5" ry="2" transform="rotate( 30 6.5 74)" />
        <ellipse cx="1.5" cy="82" rx="4.5" ry="2" transform="rotate(-25 1.5 82)" />

        <rect x="95.3" y="24" width="1.2" height="64" rx="0.6" />
        <ellipse cx="99.5" cy="33" rx="4.5" ry="2" transform="rotate( 40 99.5 33)" />
        <ellipse cx="93.5" cy="41" rx="4.5" ry="2" transform="rotate(-35 93.5 41)" />
        <ellipse cx="99.5" cy="50" rx="4.5" ry="2" transform="rotate( 38 99.5 50)" />
        <ellipse cx="93.5" cy="58" rx="4.5" ry="2" transform="rotate(-35 93.5 58)" />
        <ellipse cx="99.5" cy="66" rx="4.5" ry="2" transform="rotate( 35 99.5 66)" />
        <ellipse cx="93.5" cy="74" rx="4.5" ry="2" transform="rotate(-30 93.5 74)" />
        <ellipse cx="98.5" cy="82" rx="4.5" ry="2" transform="rotate( 25 98.5 82)" />
      </g>
    ),

    /* ── OAK ───────────────────────────────────────────────────────────────── */
    oak: (
      <g fill={c} opacity="0.85">
        <rect x="3.5" y="24" width="1.5" height="64" rx="0.7" />
        <path d="M 4,32 C 0,29 -5,29 -5,32 C -5,35 -1,36 0,34 C -1,37 -4,39 -3,41 C -1,43 2,42 3,40 C 3,42 4,44 4,44 Z" />
        <path d="M 4,46 C 8,43 11,43 11,46 C 11,49  7,50  6,48 C  7,51 10,53  9,55 C  7,57 4,56  3,54 C 3,56 4,58 4,58 Z" />
        <path d="M 4,60 C 0,57 -5,57 -5,60 C -5,63 -1,64  0,62 C -1,65 -4,67 -3,69 C -1,71 2,70  3,68 C 3,70 4,72 4,72 Z" />
        <path d="M 4,74 C 8,71 11,71 11,74 C 11,77  7,78  6,76 C  7,79 10,81  9,83 C  7,85 4,84  3,82 Z" />

        <rect x="95" y="24" width="1.5" height="64" rx="0.7" />
        <path d="M 96,32 C 100,29 105,29 105,32 C 105,35 101,36 100,34 C 101,37 104,39 103,41 C 101,43 98,42 97,40 C 97,42 96,44 96,44 Z" />
        <path d="M 96,46 C  92,43  89,43  89,46 C  89,49  93,50  94,48 C  93,51  90,53  91,55 C  93,57  96,56  97,54 C 97,56 96,58 96,58 Z" />
        <path d="M 96,60 C 100,57 105,57 105,60 C 105,63 101,64 100,62 C 101,65 104,67 103,69 C 101,71 98,70  97,68 C 97,70 96,72 96,72 Z" />
        <path d="M 96,74 C  92,71  89,71  89,74 C  89,77  93,78  94,76 C  93,79  90,81  91,83 C  93,85  96,84  97,82 Z" />
      </g>
    ),

    /* ── SCROLLS (replacing olive) ───────────────────────────────────────── */
    scrolls: (
      <g fill={c} opacity="0.85">
        {/* LEFT scroll */}
        <rect x="1" y="34" width="8" height="42" rx="1" />
        <ellipse cx="5" cy="32" rx="5.5" ry="3.5" />
        <ellipse cx="5" cy="78" rx="5.5" ry="3.5" />
        {/* Curl at top */}
        <path d="M -1,32 C -3,28 0,24 4,24 C 8,24 10,28 8,30" fill="none" stroke={c} strokeWidth="1.5" />
        {/* Curl at bottom */}
        <path d="M -1,78 C -3,82 0,86 4,86 C 8,86 10,82 8,80" fill="none" stroke={c} strokeWidth="1.5" />
        {/* Line details */}
        <rect x="2.5" y="40" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="2.5" y="46" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="2.5" y="52" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="2.5" y="58" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="2.5" y="64" width="5" height="0.8" rx="0.4" opacity="0.3" />

        {/* RIGHT scroll — mirror */}
        <rect x="91" y="34" width="8" height="42" rx="1" />
        <ellipse cx="95" cy="32" rx="5.5" ry="3.5" />
        <ellipse cx="95" cy="78" rx="5.5" ry="3.5" />
        <path d="M 101,32 C 103,28 100,24 96,24 C 92,24 90,28 92,30" fill="none" stroke={c} strokeWidth="1.5" />
        <path d="M 101,78 C 103,82 100,86 96,86 C 92,86 90,82 92,80" fill="none" stroke={c} strokeWidth="1.5" />
        <rect x="92.5" y="40" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="92.5" y="46" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="92.5" y="52" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="92.5" y="58" width="5" height="0.8" rx="0.4" opacity="0.3" />
        <rect x="92.5" y="64" width="5" height="0.8" rx="0.4" opacity="0.3" />
      </g>
    ),

    /* ── ROSES ─────────────────────────────────────────────────────────────── */
    roses: (
      <g fill={c} opacity="0.85">
        <rect x="3.5" y="24" width="1.2" height="64" rx="0.6" />
        {[32, 48, 64, 80].map(y => (
          <g key={y} transform={`translate(4, ${y})`}>
            <circle cx="-1.5" cy="0" r="3.5" opacity="0.40" />
            <circle cx=" 1.5" cy="0" r="3.5" opacity="0.40" />
            <circle cx="0" cy="-1.5" r="3.5" opacity="0.40" />
            <circle cx="0" cy=" 1.5" r="3.5" opacity="0.40" />
            <circle cx="0" cy="0" r="2" opacity="0.85" />
          </g>
        ))}
        <rect x="95.3" y="24" width="1.2" height="64" rx="0.6" />
        {[32, 48, 64, 80].map(y => (
          <g key={y} transform={`translate(96, ${y})`}>
            <circle cx="-1.5" cy="0" r="3.5" opacity="0.40" />
            <circle cx=" 1.5" cy="0" r="3.5" opacity="0.40" />
            <circle cx="0" cy="-1.5" r="3.5" opacity="0.40" />
            <circle cx="0" cy=" 1.5" r="3.5" opacity="0.40" />
            <circle cx="0" cy="0" r="2" opacity="0.85" />
          </g>
        ))}
      </g>
    ),

    /* ── RIBBON ────────────────────────────────────────────────────────────── */
    ribbon: (
      <g fill={c} opacity="0.80">
        <path d="M 2,24 C -2,32 8,40 2,50 C -2,58 8,66 2,74 C -2,82 4,87 4,90
                 L 6,90 C 6,87 0,82 4,74 C 8,66 -1,58 4,50 C 8,40 -1,32 4,24 Z" />
        <path d="M 2,90 L -3,100 L 4,93 L 6,90 Z" />

        <path d="M 98,24 C 102,32 92,40 98,50 C 102,58 92,66 98,74 C 102,82 96,87 96,90
                 L 94,90 C 94,87 100,82 96,74 C 92,66 101,58 96,50 C 92,40 101,32 96,24 Z" />
        <path d="M 98,90 L 103,100 L 96,93 L 94,90 Z" />
      </g>
    ),

    /* ── CROSSED SWORDS (refined, elegant version) ──────────────────────── */
    crossed_swords: (
      <g fill={c} opacity="0.88">
        {/* LEFT sword — blade crossing from lower-left to upper-right */}
        {/* Blade */}
        <path d="M 12,20 L 14,22 L 3,80 L 1,78 Z" />
        {/* Crossguard — curved */}
        <path d="M -4,78 C -2,75 10,75 12,78 C 10,81 -2,81 -4,78 Z" />
        {/* Grip (wrapped look) */}
        <rect x="2" y="80" width="3.5" height="10" rx="1.8" />
        <rect x="2.5" y="82" width="2.5" height="1" rx="0.5" opacity="0.3" />
        <rect x="2.5" y="85" width="2.5" height="1" rx="0.5" opacity="0.3" />
        <rect x="2.5" y="88" width="2.5" height="1" rx="0.5" opacity="0.3" />
        {/* Pommel — round */}
        <circle cx="3.75" cy="92.5" r="2.5" />

        {/* RIGHT sword — mirror */}
        <path d="M 88,20 L 86,22 L 97,80 L 99,78 Z" />
        <path d="M 104,78 C 102,75 90,75 88,78 C 90,81 102,81 104,78 Z" />
        <rect x="94.5" y="80" width="3.5" height="10" rx="1.8" />
        <rect x="95" y="82" width="2.5" height="1" rx="0.5" opacity="0.3" />
        <rect x="95" y="85" width="2.5" height="1" rx="0.5" opacity="0.3" />
        <rect x="95" y="88" width="2.5" height="1" rx="0.5" opacity="0.3" />
        <circle cx="96.25" cy="92.5" r="2.5" />
      </g>
    ),

    /* ── WINGS (fixed) ─────────────────────────────────────────────────────── */
    /* Single solid silhouette per side — 3-layer feather fan curving outward.  */
    wings: (
      <g fill={c} opacity="0.78">
        {/* LEFT wing */}
        <path d="
          M 8,62
          C 2,64  -6,68  -9,58
          C -7,52  -1,51   3,50
          C -3,46 -10,40 -10,42
          C -8,35   0,35   4,34
          C  0,29  -7,25  -7,24
          C -3,18   3,23   8,30
          Z
        " />
        {/* RIGHT wing */}
        <path d="
          M 92,62
          C 98,64 106,68 109,58
          C 107,52 101,51  97,50
          C 103,46 110,40 110,42
          C 108,35 100,35  96,34
          C 100,29 107,25 107,24
          C 103,18  97,23  92,30
          Z
        " />
      </g>
    ),

    /* ── TORCHES (new) ─────────────────────────────────────────────────────── */
    torches: (
      <g fill={c} opacity="0.88">
        {/* LEFT torch */}
        {/* Outer flame */}
        <path d="M 4,48 C -1,40 0,30 4,24 C 8,30 9,40 4,48 Z" />
        {/* Inner flame highlight (slightly smaller, more opaque) */}
        <path d="M 4,46 C 2,40 3,33 4,28 C 5,33 6,40 4,46 Z" opacity="0.5" />
        {/* Torch head (wrapped cloth) */}
        <path d="M 0,48 L 8,48 L 7,56 L 1,56 Z" />
        {/* Handle */}
        <rect x="1.5" y="56" width="5" height="30" rx="1.5" />
        {/* Bottom ferrule */}
        <rect x="0.5" y="84" width="7" height="3" rx="1" />
        {/* Pommel knob */}
        <ellipse cx="4" cy="89" rx="3.5" ry="2.5" />

        {/* RIGHT torch — mirror at x=100 */}
        <path d="M 96,48 C 101,40 100,30 96,24 C 92,30 91,40 96,48 Z" />
        <path d="M 96,46 C 98,40 97,33 96,28 C 95,33 94,40 96,46 Z" opacity="0.5" />
        <path d="M 100,48 L 92,48 L 93,56 L 99,56 Z" />
        <rect x="93.5" y="56" width="5" height="30" rx="1.5" />
        <rect x="92.5" y="84" width="7" height="3" rx="1" />
        <ellipse cx="96" cy="89" rx="3.5" ry="2.5" />
      </g>
    ),

    /* ── SPEARS (new) ──────────────────────────────────────────────────────── */
    spears: (
      <g fill={c} opacity="0.88">
        {/* LEFT spear */}
        {/* Spearhead — elongated leaf shape */}
        <path d="M 4,22 L 8,36 L 5.2,33 L 5.2,88 L 2.8,88 L 2.8,33 L 0,36 Z" />
        {/* Butt cap */}
        <ellipse cx="4" cy="90" rx="3" ry="2.2" />
        {/* Binding wrap — two thin bands on the shaft */}
        <rect x="2.5" y="50" width="3" height="2.5" rx="0.5" opacity="0.6" />
        <rect x="2.5" y="65" width="3" height="2.5" rx="0.5" opacity="0.6" />

        {/* RIGHT spear — mirror */}
        <path d="M 96,22 L 92,36 L 94.8,33 L 94.8,88 L 97.2,88 L 97.2,33 L 100,36 Z" />
        <ellipse cx="96" cy="90" rx="3" ry="2.2" />
        <rect x="94.5" y="50" width="3" height="2.5" rx="0.5" opacity="0.6" />
        <rect x="94.5" y="65" width="3" height="2.5" rx="0.5" opacity="0.6" />
      </g>
    ),

    /* ── BATTLE AXES (replacing arrows) ──────────────────────────────────── */
    axes: (
      <g fill={c} opacity="0.88">
        {/* LEFT axe */}
        {/* Shaft */}
        <rect x="2.5" y="28" width="3" height="62" rx="1.5" />
        {/* Axe head — double-sided crescent blade */}
        <path d="M 5.5,30 C 12,26 14,32 14,38 C 14,44 12,50 5.5,46 Z" />
        <path d="M 2.5,30 C -4,26 -6,32 -6,38 C -6,44 -4,50 2.5,46 Z" />
        {/* Shaft cap */}
        <ellipse cx="4" cy="92" rx="3" ry="2" />

        {/* RIGHT axe — mirror */}
        <rect x="94.5" y="28" width="3" height="62" rx="1.5" />
        <path d="M 94.5,30 C 88,26 86,32 86,38 C 86,44 88,50 94.5,46 Z" />
        <path d="M 97.5,30 C 104,26 106,32 106,38 C 106,44 104,50 97.5,46 Z" />
        <ellipse cx="96" cy="92" rx="3" ry="2" />
      </g>
    ),

    /* ── VINES (new) ───────────────────────────────────────────────────────── */
    vines: (
      <g fill={c} opacity="0.85">
        {/* LEFT vine — stem + alternating leaves + berry clusters */}
        <rect x="3.5" y="24" width="1" height="66" rx="0.5" />
        {/* Left-side leaves */}
        <path d="M 4,32 C 1,29 -4,30 -3,34 C -2,38  1,37  3,39 C 4,36 5,33 4,32 Z" />
        <path d="M 4,50 C 1,47 -4,48 -3,52 C -2,56  1,55  3,57 C 4,54 5,51 4,50 Z" />
        <path d="M 4,68 C 1,65 -4,66 -3,70 C -2,74  1,73  3,75 C 4,72 5,69 4,68 Z" />
        {/* Right-side leaves */}
        <path d="M 4,41 C 7,38 12,39 11,43 C 10,47  7,46  5,48 C 4,45 3,42 4,41 Z" />
        <path d="M 4,59 C 7,56 12,57 11,61 C 10,65  7,64  5,66 C 4,63 3,60 4,59 Z" />
        <path d="M 4,77 C 7,74 12,75 11,79 C 10,83  7,82  5,84 C 4,81 3,78 4,77 Z" />
        {/* Berries */}
        <circle cx="-1" cy="36" r="1.8" />
        <circle cx="-2.5" cy="38" r="1.4" />
        <circle cx="9" cy="45" r="1.8" />
        <circle cx="10.5" cy="47" r="1.4" />
        <circle cx="-1" cy="54" r="1.8" />
        <circle cx="9" cy="63" r="1.8" />

        {/* RIGHT vine — mirror */}
        <rect x="95.5" y="24" width="1" height="66" rx="0.5" />
        <path d="M 96,32 C 99,29 104,30 103,34 C 102,38 99,37 97,39 C 96,36 95,33 96,32 Z" />
        <path d="M 96,50 C 99,47 104,48 103,52 C 102,56 99,55 97,57 C 96,54 95,51 96,50 Z" />
        <path d="M 96,68 C 99,65 104,66 103,70 C 102,74 99,73 97,75 C 96,72 95,69 96,68 Z" />
        <path d="M 96,41 C 93,38 88,39 89,43 C 90,47 93,46 95,48 C 96,45 97,42 96,41 Z" />
        <path d="M 96,59 C 93,56 88,57 89,61 C 90,65 93,64 95,66 C 96,63 97,60 96,59 Z" />
        <path d="M 96,77 C 93,74 88,75 89,79 C 90,83 93,82 95,84 C 96,81 97,78 96,77 Z" />
        <circle cx="101" cy="36" r="1.8" />
        <circle cx="102.5" cy="38" r="1.4" />
        <circle cx="91" cy="45" r="1.8" />
        <circle cx="89.5" cy="47" r="1.4" />
        <circle cx="101" cy="54" r="1.8" />
        <circle cx="91" cy="63" r="1.8" />
      </g>
    ),

    /* ── CANDLES (new) ─────────────────────────────────────────────────────── */
    candles: (
      <g fill={c} opacity="0.88">
        {/* LEFT candle */}
        {/* Flame outer */}
        <path d="M 4,26 C 0,20 1,12 4,8 C 7,12 8,20 4,26 Z" />
        {/* Flame inner (accent) */}
        <path d="M 4,24 C 2.5,19 3,14 4,11 C 5,14 5.5,19 4,24 Z" opacity="0.45" />
        {/* Wax drip left */}
        <path d="M 2,26 C 0,30 1,34 3,34 C 3,30 2.5,28 2,26 Z" />
        {/* Wax drip right */}
        <path d="M 6,26 C 8,30 7,34 5,34 C 5,30 5.5,28 6,26 Z" />
        {/* Candle body */}
        <rect x="1.5" y="26" width="5" height="52" rx="1" />
        {/* Wax pool at base */}
        <ellipse cx="4" cy="78" rx="5.5" ry="2" />
        {/* Holder cup */}
        <path d="M -1,78 L 9,78 L 10,84 L -2,84 Z" />
        {/* Saucer */}
        <ellipse cx="4" cy="85" rx="7" ry="2.5" />

        {/* RIGHT candle — mirror */}
        <path d="M 96,26 C 100,20 99,12 96,8 C 93,12 92,20 96,26 Z" />
        <path d="M 96,24 C 97.5,19 97,14 96,11 C 95,14 94.5,19 96,24 Z" opacity="0.45" />
        <path d="M 98,26 C 100,30 99,34 97,34 C 97,30 97.5,28 98,26 Z" />
        <path d="M 94,26 C 92,30 93,34 95,34 C 95,30 94.5,28 94,26 Z" />
        <rect x="93.5" y="26" width="5" height="52" rx="1" />
        <ellipse cx="96" cy="78" rx="5.5" ry="2" />
        <path d="M 101,78 L 91,78 L 90,84 L 102,84 Z" />
        <ellipse cx="96" cy="85" rx="7" ry="2.5" />
      </g>
    ),

    /* ── BANNERS (replacing columns) ─────────────────────────────────────── */
    banners: (
      <g fill={c} opacity="0.85">
        {/* LEFT banner */}
        {/* Pole */}
        <rect x="3" y="22" width="2" height="72" rx="1" />
        {/* Pole finial — sphere */}
        <circle cx="4" cy="20" r="3" />
        {/* Flag — pennant shape */}
        <path d="M 5,26 L 16,30 C 14,36 16,42 16,48 L 5,44 Z" />
        {/* Flag accent stripe */}
        <path d="M 5,34 L 14,37 L 14,39 L 5,36 Z" opacity="0.3" />

        {/* RIGHT banner — mirror */}
        <rect x="95" y="22" width="2" height="72" rx="1" />
        <circle cx="96" cy="20" r="3" />
        <path d="M 95,26 L 84,30 C 86,36 84,42 84,48 L 95,44 Z" />
        <path d="M 95,34 L 86,37 L 86,39 L 95,36 Z" opacity="0.3" />
      </g>
    ),
  };

  return flourishSvg[type] || null;
}

/* ─────────────── Component ─────────────── */

export function ShieldBuilder({ config, familyName, onChange }: Props) {
  const t = useTranslations('Onboarding');
  const currentShape = SHAPES.find(s => s.value === config.shape) || SHAPES[0];
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
      accent_color: pick(DETAIL_COLORS).value,
      symbol_color: pick(['#FFFFFF', '#F5F5F5', '#FFD700', '#E8E8E8', '#1C1C1C', '#C5A84B']
      ).toString(),
      division: pick(PATTERNS).value,
      crest_animal: pickNonNone(CREST_ANIMALS).value,
      flourish: pick(FLOURISHES).value,
      center_symbol: pickNonNone(CENTER_SYMBOLS).value,
      font_style: pick(['serif', 'sans', 'script', 'gothic', 'classic']),
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
            {config.division !== 'none' && getPatternDef(config.division, config.secondary_color, 'shieldPattern')}
          </defs>


          {/* Shield base */}
          <path d={currentShape.path} fill={config.primary_color} stroke={config.accent_color} strokeWidth="2.5" />

          {/* Shield Pattern */}
          {config.division !== 'none' && (
            <rect x="0" y="0" width="100" height="100" fill="url(#shieldPattern)" clipPath="url(#shieldClip)" opacity="0.35" />
          )}

          {/* Border accent */}
          <path d={currentShape.path} fill="none" stroke={config.accent_color} strokeWidth="1.5" opacity="0.5"
            transform="scale(0.9) translate(5.5, 5.5)" />

          {/* Flourishes (behind shield) */}
          {renderFlourish(config.flourish, config.accent_color)}

          {/* Center Symbol */}
          {currentSymbol && currentSymbol.path && (
            <g transform="translate(50, 42)">
              <path d={currentSymbol.path} fill={config.symbol_color} opacity="0.85" />
            </g>
          )}

          {/* Initials */}
          {config.initials && (
            <text
              x="50" y={currentSymbol && currentSymbol.path ? 62 : 50}
              textAnchor="middle" dominantBaseline="middle"
              fill={config.symbol_color} fontFamily={font}
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
              <rect x="5" y="99" width="90" height="11" rx="2" fill={config.primary_color} stroke={config.accent_color} strokeWidth="0.8" opacity="0.9" />
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

        {/* ── Pattern Colour ── */}
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

        {/* ── Detail Colour (border, crest, flourish, family name) ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldDetail')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {DETAIL_COLORS.map(c => (
              <button key={c.value} type="button" onClick={() => onChange({ ...config, accent_color: c.value })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.accent_color === c.value ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.value }} title={c.label} />
            ))}
          </div>
        </div>

        {/* ── Symbol & Initials Colour ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldSymbolColor')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: '#FFFFFF', label: 'White' },
              { value: '#F5F5F5', label: 'Snow' },
              { value: '#E8E8E8', label: 'Silver' },
              { value: '#FFD700', label: 'Gold' },
              { value: '#C5A84B', label: 'Old Gold' },
              { value: '#1C1C1C', label: 'Black' },
              { value: '#8B0000', label: 'Crimson' },
              { value: '#1B2A4A', label: 'Azure' },
              { value: '#1A5C2E', label: 'Vert' },
              { value: '#2B1055', label: 'Purple' },
            ].map(c => (
              <button key={c.value} type="button" onClick={() => onChange({ ...config, symbol_color: c.value })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.symbol_color === c.value ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.value }} title={c.label} />
            ))}
            <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 cursor-pointer overflow-hidden hover:border-primary transition-colors" title="Custom">
              <input type="color" value={config.symbol_color} onChange={e => onChange({ ...config, symbol_color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">+</span>
            </label>
          </div>
        </div>

        {/* ── Shield Pattern ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shieldDivision')}</p>
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map(p => (
              <button key={p.value} type="button" onClick={() => onChange({ ...config, division: p.value })}
                className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${toggleBtn(config.division === p.value)}`} title={p.label}>
                <svg viewBox="0 0 100 100" width="24" height="24">
                  <defs>
                    <clipPath id={`patPrev_${p.value}`}><path d={SHAPES[0].path} /></clipPath>
                    {p.value !== 'none' && getPatternDef(p.value, '#64748b', `patPrev_${p.value}_fill`)}
                  </defs>
                  <path d={SHAPES[0].path} fill="#94a3b8" />
                  {p.value !== 'none' && (
                    <rect x="0" y="0" width="100" height="100" fill={`url(#patPrev_${p.value}_fill)`}
                      clipPath={`url(#patPrev_${p.value})`} opacity="0.4" />
                  )}
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
            {(['serif', 'sans', 'script', 'gothic', 'classic'] as const).map(f => (
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
