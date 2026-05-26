import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import {
  CommunityFilters,
  type CommunityFilterValues,
} from '../../components/community/CommunityFilters';

const EMPTY: CommunityFilterValues = {
  country: '',
  region: '',
  faith: '',
  ageMin: '',
  ageMax: '',
};

describe('CommunityFilters', () => {
  it('renders the current country value as the selected option', () => {
    renderWithProviders(
      <CommunityFilters value={{ ...EMPTY, country: 'IE' }} onChange={vi.fn()} />,
    );
    const country = screen.getByRole('combobox', { name: /country/i }) as HTMLSelectElement;
    expect(country.value).toBe('IE');
  });

  it('changing the country emits a new value and clears the region', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CommunityFilters value={{ ...EMPTY, country: 'IE', region: 'Munster' }} onChange={onChange} />,
    );
    const country = screen.getByRole('combobox', { name: /country/i });
    fireEvent.change(country, { target: { value: 'US' } });
    expect(onChange).toHaveBeenCalledWith({
      country: 'US',
      region: '',
      faith: '',
      ageMin: '',
      ageMax: '',
    });
  });

  it('typing in the age-from field updates ageMin', () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <CommunityFilters value={EMPTY} onChange={onChange} />,
    );
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(2);
    fireEvent.change(numberInputs[0], { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({
      country: '',
      region: '',
      faith: '',
      ageMin: '5',
      ageMax: '',
    });
  });

  it('faith dropdown shows the curated list and toggles selection', () => {
    const onChange = vi.fn();
    renderWithProviders(<CommunityFilters value={EMPTY} onChange={onChange} />);
    const faith = screen.getByRole('combobox', { name: /faith/i });
    fireEvent.change(faith, { target: { value: 'christian' } });
    expect(onChange).toHaveBeenCalledWith({
      country: '',
      region: '',
      faith: 'christian',
      ageMin: '',
      ageMax: '',
    });
  });
});
