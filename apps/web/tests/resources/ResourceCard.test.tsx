import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { ResourceCard, getTypeKey, type Resource } from '../../components/resources/ResourceCard';

const baseResource: Resource = {
  id: 'r1',
  family_id: 'f1',
  title: 'Introduction to Algebra',
  type: 'book',
  author: 'Jane Doe',
  description: null,
  url: null,
  subjects: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('getTypeKey', () => {
  it('maps known types to their translation keys', () => {
    expect(getTypeKey('book')).toBe('typeBook');
    expect(getTypeKey('article')).toBe('typeArticle');
    expect(getTypeKey('video')).toBe('typeVideo');
    expect(getTypeKey('course')).toBe('typeCourse');
    expect(getTypeKey('podcast')).toBe('typePodcast');
    expect(getTypeKey('documentary')).toBe('typeDocumentary');
    expect(getTypeKey('printable')).toBe('typePrintable');
    expect(getTypeKey('website')).toBe('typeWebsite');
    expect(getTypeKey('curriculum')).toBe('typeCurriculum');
    expect(getTypeKey('other')).toBe('typeOther');
  });

  it('falls back to typeOther for unknown types', () => {
    expect(getTypeKey('unknown_type')).toBe('typeOther');
    expect(getTypeKey('')).toBe('typeOther');
  });
});

describe('ResourceCard', () => {
  it('renders the resource title', () => {
    renderWithProviders(<ResourceCard resource={baseResource} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
  });

  it('renders the author name when present', () => {
    renderWithProviders(<ResourceCard resource={baseResource} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it('does not render author section when null', () => {
    renderWithProviders(
      <ResourceCard resource={{ ...baseResource, author: null }} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
  });

  it('renders an external URL link when url is set', () => {
    renderWithProviders(
      <ResourceCard
        resource={{ ...baseResource, url: 'https://www.youtube.com/watch?v=abc' }}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the service name (YouTube) inferred from URL', () => {
    renderWithProviders(
      <ResourceCard
        resource={{ ...baseResource, url: 'https://www.youtube.com/watch?v=abc' }}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });

  it('renders subject badges for linked subjects', () => {
    renderWithProviders(
      <ResourceCard
        resource={{
          ...baseResource,
          subjects: [
            { subject_id: 's1', subject_name: 'Math', progress_notes: null, updated_at: '' },
            { subject_id: 's2', subject_name: 'Science', progress_notes: null, updated_at: '' },
          ],
        }}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    renderWithProviders(<ResourceCard resource={baseResource} onEdit={onEdit} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    renderWithProviders(<ResourceCard resource={baseResource} onEdit={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
