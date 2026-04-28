import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { TeachingHeatmap } from '../../components/progress/TeachingHeatmap';

describe('TeachingHeatmap', () => {
  it('shows the empty-state message when cells is empty', () => {
    renderWithProviders(<TeachingHeatmap cells={[]} from="2024-06-01" to="2024-06-30" />);
    expect(screen.getByText(/heatmap|no/i)).toBeInTheDocument();
  });

  it('renders a button per day in the date grid (aligned to weeks)', () => {
    const cells = [{ date: '2024-06-15', count: 1 }];
    renderWithProviders(<TeachingHeatmap cells={cells} from="2024-06-01" to="2024-06-30" />);
    // The grid will have at least 7×5 = 35 cells (5 weeks min for a 30-day month)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(35);
  });

  it('uses bg-primary intensity for high-count cells', () => {
    const cells = [{ date: '2024-06-15', count: 5 }];
    const { container } = renderWithProviders(
      <TeachingHeatmap cells={cells} from="2024-06-01" to="2024-06-30" />,
    );
    expect(container.querySelector('.bg-primary')).not.toBeNull();
  });

  it('renders translucent intensity for low counts', () => {
    const cells = [
      { date: '2024-06-10', count: 1 },
      { date: '2024-06-15', count: 2 },
    ];
    const { container } = renderWithProviders(
      <TeachingHeatmap cells={cells} from="2024-06-01" to="2024-06-30" />,
    );
    expect(container.querySelector('.bg-primary\\/30')).not.toBeNull();
    expect(container.querySelector('.bg-primary\\/60')).not.toBeNull();
  });

  it('cells outside the range have transparent class', () => {
    const cells = [{ date: '2024-06-15', count: 1 }];
    const { container } = renderWithProviders(
      <TeachingHeatmap cells={cells} from="2024-06-15" to="2024-06-15" />,
    );
    expect(container.querySelector('.bg-transparent')).not.toBeNull();
  });

  it('each cell has an accessible aria-label', () => {
    const cells = [{ date: '2024-06-15', count: 3 }];
    renderWithProviders(
      <TeachingHeatmap cells={cells} from="2024-06-01" to="2024-06-30" />,
    );
    const labeledCell = screen.getByLabelText(/3 entries/i);
    expect(labeledCell).toBeInTheDocument();
  });

  it('singular form for count=1', () => {
    const cells = [{ date: '2024-06-15', count: 1 }];
    renderWithProviders(
      <TeachingHeatmap cells={cells} from="2024-06-01" to="2024-06-30" />,
    );
    expect(screen.getByLabelText(/1 entry/i)).toBeInTheDocument();
  });
});
