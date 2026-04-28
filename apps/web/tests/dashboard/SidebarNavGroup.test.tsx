import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarNavGroup } from '../../components/dashboard/SidebarNavGroup';

describe('SidebarNavGroup', () => {
  it('renders the label when not collapsed', () => {
    render(
      <SidebarNavGroup label="Educate" collapsed={false}>
        <div>child</div>
      </SidebarNavGroup>,
    );
    expect(screen.getByText('Educate')).toBeInTheDocument();
  });

  it('hides the label when collapsed', () => {
    render(
      <SidebarNavGroup label="Educate" collapsed>
        <div>child</div>
      </SidebarNavGroup>,
    );
    expect(screen.queryByText('Educate')).not.toBeInTheDocument();
  });

  it('renders a divider when collapsed', () => {
    const { container } = render(
      <SidebarNavGroup label="x" collapsed>
        <div>child</div>
      </SidebarNavGroup>,
    );
    expect(container.querySelector('.border-t')).not.toBeNull();
  });

  it('always renders children', () => {
    render(
      <SidebarNavGroup label="x" collapsed={false}>
        <div data-testid="child">child</div>
      </SidebarNavGroup>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
