import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ChildCard } from '../../components/children/ChildCard';

const baseChild = {
  id: 'c1',
  first_name: 'Alice',
  child_curriculum: [],
  learning_styles: [],
};

describe('ChildCard', () => {
  let onClick: ReturnType<typeof vi.fn>;
  let onEdit: ReturnType<typeof vi.fn>;
  let onArchive: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClick = vi.fn();
    onEdit = vi.fn();
    onArchive = vi.fn();
  });

  function renderCard(child = baseChild) {
    return renderWithProviders(
      <ChildCard child={child} onClick={onClick} onEdit={onEdit} onArchive={onArchive} />,
    );
  }

  it('renders the child first name', () => {
    renderCard();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders nickname with first name in parentheses when nickname is set', () => {
    renderCard({ ...baseChild, nickname: 'Allie' });
    expect(screen.getByText(/Allie \(Alice\)/)).toBeInTheDocument();
  });

  it('shows uppercase initials for the avatar (first 2 chars when single name)', () => {
    renderCard();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('shows two-name initials when display name has two parts', () => {
    renderCard({ ...baseChild, nickname: 'Mary Jane' });
    expect(screen.getByText('MJ')).toBeInTheDocument();
  });

  it('does not show grade label when grade_level is undefined', () => {
    renderCard();
    expect(screen.queryByText(/Grade/)).not.toBeInTheDocument();
  });

  it('renders grade label using the GRADE_LABELS map', () => {
    renderCard({ ...baseChild, grade_level: 'grade_3' });
    expect(screen.getByText('Grade 3')).toBeInTheDocument();
  });

  it('falls back to raw grade_level when not in map', () => {
    renderCard({ ...baseChild, grade_level: 'unknown_grade' });
    expect(screen.getByText('unknown_grade')).toBeInTheDocument();
  });

  it('renders age computed from birth_year', () => {
    const yearsAgo = new Date().getFullYear() - 8;
    renderCard({ ...baseChild, birth_year: yearsAgo });
    // text contains "8" (translation may include "years old")
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });

  it('renders curriculum chip when child_curriculum has items', () => {
    renderCard({ ...baseChild, child_curriculum: ['Classical'] });
    expect(screen.getByText('Classical')).toBeInTheDocument();
  });

  it('renders mapped learning style labels', () => {
    renderCard({ ...baseChild, learning_styles: ['visual', 'auditory'] });
    expect(screen.getByText('Visual')).toBeInTheDocument();
    expect(screen.getByText('Auditory')).toBeInTheDocument();
  });

  it('falls back to raw learning style key when not in map', () => {
    renderCard({ ...baseChild, learning_styles: ['unknown_style'] });
    expect(screen.getByText('unknown_style')).toBeInTheDocument();
  });

  it('calls onClick when the card is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByText('Alice'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('opens menu and triggers onEdit', async () => {
    renderCard();
    const menuButton = document.querySelector('button.opacity-0') as HTMLElement;
    await userEvent.click(menuButton);

    const editButton = await screen.findByText(/edit/i);
    await userEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('opens menu and triggers onArchive', async () => {
    renderCard();
    const menuButton = document.querySelector('button.opacity-0') as HTMLElement;
    await userEvent.click(menuButton);

    const archiveButton = await screen.findByText(/archive/i);
    await userEvent.click(archiveButton);

    expect(onArchive).toHaveBeenCalledOnce();
  });
});
