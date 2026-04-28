import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardProgress } from '../../components/onboarding/WizardProgress';

describe('WizardProgress', () => {
  const TITLES = ['Family', 'Faith', 'Education', 'Story'];

  it('renders current step / total steps text', () => {
    render(<WizardProgress currentStep={2} totalSteps={4} titles={TITLES} />);
    expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();
  });

  it('renders the current step title', () => {
    render(<WizardProgress currentStep={2} totalSteps={4} titles={TITLES} />);
    expect(screen.getByText('Faith')).toBeInTheDocument();
  });

  it('progress bar width reflects current step / total', () => {
    const { container } = render(
      <WizardProgress currentStep={2} totalSteps={4} titles={TITLES} />,
    );
    const bar = container.querySelector('div[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('shows 0% on step 0 (out of bounds)', () => {
    const { container } = render(
      <WizardProgress currentStep={0} totalSteps={4} titles={TITLES} />,
    );
    const bar = container.querySelector('div[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('shows 100% when on the last step', () => {
    const { container } = render(
      <WizardProgress currentStep={4} totalSteps={4} titles={TITLES} />,
    );
    const bar = container.querySelector('div[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });
});
