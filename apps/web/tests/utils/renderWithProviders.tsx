import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

/**
 * Wraps ui with the NextIntlClientProvider (locale=en, real messages) so any
 * component using useTranslations() works without mocking next-intl itself.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}
