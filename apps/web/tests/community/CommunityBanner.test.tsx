import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../utils/renderWithProviders';
import { CommunityBanner } from '../../components/community/CommunityBanner';

describe('CommunityBanner', () => {
  it('renders a fallback gradient when identity is null', () => {
    const { container } = renderWithProviders(
      <CommunityBanner identity={null} name="Test" tagline="hi" />,
    );
    const banner = container.querySelector('[style*="linear-gradient"]');
    expect(banner).not.toBeNull();
  });

  it('renders the chosen emblem when set', () => {
    const { container } = renderWithProviders(
      <CommunityBanner
        identity={{
          primary_color: '#000000',
          secondary_color: '#ffffff',
          emblem: 'compass',
          emblem_color: '#ffffff',
          layout: 'left',
        }}
        name="Test"
        tagline="hi"
      />,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('honours height=8 by skipping the name overlay (card strip mode)', () => {
    const { container } = renderWithProviders(
      <CommunityBanner identity={null} name="Test" tagline="hi" height={8} />,
    );
    expect(container.textContent).not.toContain('Test');
  });
});
