'use client';

import React from 'react';
import {
  DEFAULT_EMBLEM_COLOR, DEFAULT_PRIMARY, DEFAULT_SECONDARY, findEmblem,
} from '../../lib/communityEmblems';
import type { CommunityIdentity } from './types';

interface Props {
  identity?: CommunityIdentity | null;
  name: string;
  tagline?: string | null;
  height?: number; // px; defaults to 140 (overview banner). Set <=16 for a card strip.
  showName?: boolean; // when true, overlays the name + tagline on the gradient
}

/**
 * Renders the community identity (gradient + emblem) per v2 spec §7.3.
 *
 * Layout:
 *   - "left":  [emblem] [name / tagline]  — emblem sits to the left, text flows
 *              to its right so they never overlap.
 *   - "center": stacked vertically and centred: emblem on top, name + tagline below.
 *
 * Falls back to a neutral indigo→slate gradient with no emblem when `identity`
 * is null. Set `height <= 16` for a thin strip (no overlay text) used on cards.
 */
export function CommunityBanner({
  identity, name, tagline, height = 140, showName = true,
}: Props) {
  const primary = identity?.primary_color || DEFAULT_PRIMARY;
  const secondary = identity?.secondary_color || DEFAULT_SECONDARY;
  const emblemColor = identity?.emblem_color || DEFAULT_EMBLEM_COLOR;
  const layout = identity?.layout || 'left';
  const emblem = findEmblem(identity?.emblem || undefined);
  const Icon = emblem?.Icon;

  const minimal = height <= 16;

  if (minimal) {
    return (
      <div
        className="w-full rounded-xl"
        style={{
          height,
          background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)`,
        }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden shadow-sm px-6 py-4"
      style={{
        minHeight: height,
        background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)`,
      }}
    >
      <div
        className={`h-full flex gap-4 ${
          layout === 'center'
            ? 'flex-col items-center text-center justify-center'
            : 'flex-row items-center'
        }`}
        style={{ minHeight: height - 32 /* account for py-4 */ }}
      >
        {Icon && (
          <div className="shrink-0">
            <Icon
              style={{ color: emblemColor }}
              className={layout === 'center' ? 'w-12 h-12 opacity-95' : 'w-14 h-14 opacity-95'}
            />
          </div>
        )}
        {showName && (
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow truncate">{name}</h1>
            {tagline && <p className="text-white/85 text-sm mt-0.5 line-clamp-2">{tagline}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
