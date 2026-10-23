import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { HighlightsManager } from '../../components/children/report/HighlightsManager';

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const existing = {
  id: 'h1', child_id: 'c1', category: 'outdoor', title: 'Lake hike', description: null,
  occurred_on: '2026-05-02', created_at: '', updated_at: '',
};

describe('HighlightsManager', () => {
  let highlights: unknown[];

  beforeEach(() => {
    highlights = [existing];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('/api/v1/resources')) {
        return mockResponse([{ title: 'The Hobbit', type: 'book' }, { title: 'Planet Earth', type: 'documentary' }]);
      }
      if (url === '/api/v1/children/c1/highlights' && init?.method === 'POST') {
        const created = { ...JSON.parse(init.body as string), id: 'h2', child_id: 'c1', created_at: '', updated_at: '' };
        highlights = [...highlights, created];
        return mockResponse(created, true, 201);
      }
      if (url.startsWith('/api/v1/children/c1/highlights/h1') && init?.method === 'DELETE') {
        highlights = [];
        return mockResponse(null, true, 204);
      }
      if (url.startsWith('/api/v1/children/c1/highlights')) return mockResponse(highlights);
      return mockResponse([]);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderManager(onChanged = vi.fn()) {
    renderWithProviders(
      <HighlightsManager
        childId="c1"
        childName="Ali"
        fromDate="2026-01-01"
        toDate="2026-12-31"
        dateFormat="YYYY-MM-DD"
        onChanged={onChanged}
      />,
    );
    return onChanged;
  }

  it('lists highlights in the period grouped by type', async () => {
    renderManager();
    expect(await screen.findByText('Lake hike')).toBeInTheDocument();
    expect(screen.getByText('Outdoor activities')).toBeInTheDocument();
    expect(screen.getByText('2026-05-02')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/children/c1/highlights?from=2026-01-01&to=2026-12-31');
  });

  it('adds a book highlight and notifies the page', async () => {
    const onChanged = renderManager();
    await screen.findByText('Lake hike');

    fireEvent.click(screen.getByRole('button', { name: /add highlight/i }));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'The Hobbit' } });
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'Read aloud' } });
    fireEvent.submit(screen.getByLabelText(/^Title/).closest('form')!);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      category: 'book', title: 'The Hobbit', occurred_on: '2026-03-10', description: 'Read aloud',
    });
    expect(await screen.findByText('Books read')).toBeInTheDocument();
  });

  it('saves a highlight without a date', async () => {
    const onChanged = renderManager();
    await screen.findByText('Lake hike');

    fireEvent.click(screen.getByRole('button', { name: /add highlight/i }));
    fireEvent.change(screen.getByLabelText('Type*'), { target: { value: 'social' } });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Weekly co-op' } });
    fireEvent.submit(screen.getByLabelText(/^Title/).closest('form')!);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      category: 'social', title: 'Weekly co-op', occurred_on: null, description: null,
    });
    expect(await screen.findByText('Weekly co-op')).toBeInTheDocument();
  });

  it('suggests book titles from the family resources', async () => {
    renderManager();
    await screen.findByText('Lake hike');
    fireEvent.click(screen.getByRole('button', { name: /add highlight/i }));
    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('#highlight-suggestions option')).map((o) => o.getAttribute('value'));
      expect(options).toEqual(['The Hobbit']);
    });
  });

  it('deletes a highlight', async () => {
    const onChanged = renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Lake hike' }));
    await waitFor(() => expect(screen.queryByText('Lake hike')).not.toBeInTheDocument());
    expect(onChanged).toHaveBeenCalled();
  });
});
