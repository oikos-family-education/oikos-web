import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShieldPreview } from '../../components/onboarding/ShieldPreview';
import type { ShieldConfig } from '../../components/onboarding/ShieldBuilder';

const baseConfig: ShieldConfig = {
  initials: 'SF',
  shape: 'heater',
  primary_color: '#4f46e5',
  secondary_color: '#a5b4fc',
  accent_color: '#1e293b',
  symbol_color: '#ffffff',
  division: 'none',
  crest_animal: 'none',
  flourish: 'none',
  center_symbol: 'none',
  font_style: 'serif',
};

describe('ShieldPreview', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ShieldPreview config={baseConfig} familyName="Smith" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders initials text', () => {
    const { container } = render(<ShieldPreview config={baseConfig} familyName="Smith" />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('SF');
  });

  it('renders the family name when showFamilyName=true (default)', () => {
    const { container } = render(<ShieldPreview config={baseConfig} familyName="Smith" />);
    const texts = Array.from(container.querySelectorAll('text'));
    expect(texts.some((t) => t.textContent?.includes('SMITH'))).toBe(true);
  });

  it('hides family name when showFamilyName=false', () => {
    const { container } = render(
      <ShieldPreview config={baseConfig} familyName="Smith" showFamilyName={false} />,
    );
    const texts = Array.from(container.querySelectorAll('text'));
    expect(texts.some((t) => t.textContent?.includes('SMITH'))).toBe(false);
  });

  it('respects width and height props', () => {
    const { container } = render(
      <ShieldPreview config={baseConfig} familyName="Smith" width={120} height={140} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('120');
    expect(svg.getAttribute('height')).toBe('140');
  });

  it('renders without initials when not provided', () => {
    const { container } = render(
      <ShieldPreview config={{ ...baseConfig, initials: '' }} familyName="Smith" />,
    );
    const initialsText = Array.from(container.querySelectorAll('text')).find(
      (t) => t.textContent === 'SF',
    );
    expect(initialsText).toBeUndefined();
  });
});
