import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { SubjectCard } from '../../components/subjects/SubjectCard';

const baseSubject = {
  id: 's1',
  family_id: 'f1',
  name: 'Mathematics',
  short_description: null,
  category: 'core_academic',
  color: '#4f46e5',
  icon: null,
  priority: 2,
  min_age_years: null,
  max_age_years: null,
  is_platform_subject: false,
  is_public: false,
};

describe('SubjectCard', () => {
  it('renders the subject name', () => {
    renderWithProviders(<SubjectCard subject={baseSubject} onFork={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
  });

  it('renders the short description when present', () => {
    renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, short_description: 'A core academic subject' }}
        onFork={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('A core academic subject')).toBeInTheDocument();
  });

  it('renders Edit button when family_id is present and not platform', () => {
    const onEdit = vi.fn();
    renderWithProviders(
      <SubjectCard subject={baseSubject} onFork={() => {}} onEdit={onEdit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('renders Fork button when subject is a platform subject', () => {
    const onFork = vi.fn();
    renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, is_platform_subject: true, family_id: null }}
        onFork={onFork}
        onEdit={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /fork|customise|customize/i }));
    expect(onFork).toHaveBeenCalledOnce();
  });

  it('shows platform badge for platform subjects', () => {
    const { container } = renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, is_platform_subject: true }}
        onFork={() => {}}
        onEdit={() => {}}
      />,
    );
    const badge = container.querySelector('.bg-primary\\/10');
    expect(badge).not.toBeNull();
  });

  it('shows community badge for public non-platform subjects', () => {
    const { container } = renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, is_public: true, is_platform_subject: false }}
        onFork={() => {}}
        onEdit={() => {}}
      />,
    );
    const badge = container.querySelector('.bg-emerald-100');
    expect(badge).not.toBeNull();
  });

  it('renders age range when both min and max are set', () => {
    renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, min_age_years: 5, max_age_years: 12 }}
        onFork={() => {}}
        onEdit={() => {}}
      />,
    );
    // The translation typically formats "Ages 5–12" or similar — both numbers appear
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });
});
