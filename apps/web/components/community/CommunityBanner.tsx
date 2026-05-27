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
  height?: number; // px; defaults to 140 (overview banner). Set 8 for a card strip.
  showName?: boolean; // when true, overlays the name + tagline on the gradient
}

/**
 * Renders the community identity (gradient + emblem) per v2 spec §7.3.
 *
 * When `identity` is null or missing fields, falls back to a neutral
 * indigo→slate gradient with no emblem.
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

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden ${minimal ? '' : 'shadow-sm'}`}
      style={{
        height,
        background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)`,
      }}
      aria-hidden={minimal ? true : undefined}
    >
      {!minimal && Icon && (
        <div
          className={`absolute inset-0 flex items-center ${
            layout === 'center' ? 'justify-center' : 'justify-start pl-6'
          }`}
        >
          <Icon style={{ color: emblemColor }} className="w-16 h-16 opacity-90" />
        </div>
      )}
      {!minimal && showName && (
        <div
          className={`absolute inset-0 flex flex-col justify-end px-6 py-4 ${
            layout === 'center' && Icon ? 'items-center text-center' : 'items-start'
          }`}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow">{name}</h1>
          {tagline && <p className="text-white/85 text-sm mt-0.5">{tagline}</p>}
        </div>
      )}
    </div>
  );
}
