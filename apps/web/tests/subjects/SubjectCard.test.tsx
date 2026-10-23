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

  it('renders Delete button for family subjects when onDelete is provided', () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <SubjectCard
        subject={baseSubject}
        onFork={() => {}}
        onEdit={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('does not render Delete button when onDelete is not provided', () => {
    renderWithProviders(
      <SubjectCard subject={baseSubject} onFork={() => {}} onEdit={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('does not render Delete button for platform subjects even when onDelete is provided', () => {
    renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, is_platform_subject: true, family_id: null }}
        onFork={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
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

  it('renders Archive for active family subjects when onArchive is provided', () => {
    const onArchive = vi.fn();
    renderWithProviders(
      <SubjectCard subject={baseSubject} onFork={() => {}} onEdit={() => {}} onArchive={onArchive} />,
    );
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('renders who teaches the subject when a responsible name is given', () => {
    renderWithProviders(
      <SubjectCard subject={baseSubject} onFork={() => {}} onEdit={() => {}} responsibleName="Pedro" />,
    );
    expect(screen.getByText('Taught by Pedro')).toBeInTheDocument();
  });

  it('renders the Archived badge and Unarchive for archived subjects', () => {
    const onUnarchive = vi.fn();
    renderWithProviders(
      <SubjectCard
        subject={{ ...baseSubject, archived_at: '2026-10-01T00:00:00Z' }}
        onFork={() => {}}
        onEdit={() => {}}
        onArchive={() => {}}
        onUnarchive={onUnarchive}
      />,
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /unarchive/i }));
    expect(onUnarchive).toHaveBeenCalledOnce();
  });
});
