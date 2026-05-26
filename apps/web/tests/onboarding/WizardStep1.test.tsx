import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { WizardStep1 } from '../../components/onboarding/WizardStep1';
import { buildDefaultFormData } from '../../components/family/familyFormTypes';

/**
 * Regression cover for the bug in PR #29 where the country field was a free-text
 * input that only saved `location_country` and left `location_country_code`
 * blank — making families invisible to the Discover country filter.
 */
describe('WizardStep1 country picker', () => {
  it('writes both location_country and location_country_code when a country is picked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <WizardStep1 data={buildDefaultFormData()} onChange={onChange} />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'IE' } });

    expect(onChange).toHaveBeenCalledWith({
      location_country_code: 'IE',
      location_country: 'Ireland',
    });
  });

  it('clears both fields when the placeholder option is selected', () => {
    const onChange = vi.fn();
    const data = {
      ...buildDefaultFormData(),
      location_country: 'Ireland',
      location_country_code: 'IE',
    };
    renderWithProviders(<WizardStep1 data={data} onChange={onChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('IE');

    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({
      location_country_code: '',
      location_country: '',
    });
  });

  it('renders Ireland as a selectable option', () => {
    renderWithProviders(
      <WizardStep1 data={buildDefaultFormData()} onChange={vi.fn()} />,
    );
    const ireland = screen.getByRole('option', { name: 'Ireland' }) as HTMLOptionElement;
    expect(ireland.value).toBe('IE');
  });
});
