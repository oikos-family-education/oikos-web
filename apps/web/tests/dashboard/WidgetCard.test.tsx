import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetCard, WidgetSkeleton, WidgetError, WidgetEmpty } from '../../components/dashboard/WidgetCard';

describe('WidgetCard', () => {
  it('renders the title and children', () => {
    render(
      <WidgetCard title="My Widget">
        <p>Inner content</p>
      </WidgetCard>,
    );
    expect(screen.getByRole('heading', { name: 'My Widget' })).toBeInTheDocument();
    expect(screen.getByText('Inner content')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(<WidgetCard title="T" subtitle="A subtitle">x</WidgetCard>);
    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('does not render subtitle when omitted', () => {
    render(<WidgetCard title="T">x</WidgetCard>);
    expect(screen.queryByText('A subtitle')).not.toBeInTheDocument();
  });

  it('renders actions on the right when provided', () => {
    render(
      <WidgetCard title="T" actions={<button>Action</button>}>
        x
      </WidgetCard>,
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('appends custom className', () => {
    const { container } = render(
      <WidgetCard title="T" className="my-extra-class">
        x
      </WidgetCard>,
    );
    expect(container.firstChild).toHaveClass('my-extra-class');
  });
});

describe('WidgetSkeleton', () => {
  it('defaults to 3 rows', () => {
    const { container } = render(<WidgetSkeleton />);
    expect(container.querySelectorAll('div.h-12').length).toBe(3);
  });

  it('renders the requested number of rows', () => {
    const { container } = render(<WidgetSkeleton rows={5} />);
    expect(container.querySelectorAll('div.h-12').length).toBe(5);
  });
});

describe('WidgetError', () => {
  it('renders default error message', () => {
    render(<WidgetError />);
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
  });

  it('renders custom error message', () => {
    render(<WidgetError message="Custom failure" />);
    expect(screen.getByText('Custom failure')).toBeInTheDocument();
  });

  it('shows Try again button only when onRetry is provided', () => {
    const { rerender } = render(<WidgetError />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

    rerender(<WidgetError onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onRetry when the button is clicked', () => {
    const handler = vi.fn();
    render(<WidgetError onRetry={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('WidgetEmpty', () => {
  it('renders the title', () => {
    render(<WidgetEmpty title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders the hint when provided', () => {
    render(<WidgetEmpty title="t" hint="Try this" />);
    expect(screen.getByText('Try this')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<WidgetEmpty title="t" icon={<span data-testid="icon">i</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders the cta when provided', () => {
    render(<WidgetEmpty title="t" cta={<a href="/x">Go</a>} />);
    expect(screen.getByRole('link', { name: 'Go' })).toBeInTheDocument();
  });
});
