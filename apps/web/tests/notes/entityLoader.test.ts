import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadEntityOptions } from '../../components/notes/entityLoader';

describe('loadEntityOptions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns child options using nickname when present, else first_name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'c1', first_name: 'Alice', nickname: 'Allie' },
        { id: 'c2', first_name: 'Bob', nickname: null },
      ],
    } as Response);

    const opts = await loadEntityOptions('child');
    expect(opts).toEqual([
      { id: 'c1', label: 'Allie' },
      { id: 'c2', label: 'Bob' },
    ]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/families/me/children');
  });

  it('returns subject options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 's1', name: 'Math' }],
    } as Response);

    const opts = await loadEntityOptions('subject');
    expect(opts).toEqual([{ id: 's1', label: 'Math' }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/subjects?source=mine');
  });

  it('returns resource options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'r1', title: 'A book' }],
    } as Response);

    const opts = await loadEntityOptions('resource');
    expect(opts).toEqual([{ id: 'r1', label: 'A book' }]);
  });

  it('returns project options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'p1', title: 'Science Fair' }],
    } as Response);

    const opts = await loadEntityOptions('project');
    expect(opts).toEqual([{ id: 'p1', label: 'Science Fair' }]);
  });

  it('returns event options with date range params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'e1', title: 'Trip' }],
    } as Response);

    const opts = await loadEntityOptions('event');
    expect(opts).toEqual([{ id: 'e1', label: 'Trip' }]);

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/calendar/events');
    expect(url).toMatch(/from=\d{4}-\d{2}-\d{2}/);
    expect(url).toMatch(/to=\d{4}-\d{2}-\d{2}/);
  });

  it('returns empty array when fetch fails (any entity type)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    expect(await loadEntityOptions('child')).toEqual([]);
    expect(await loadEntityOptions('subject')).toEqual([]);
    expect(await loadEntityOptions('resource')).toEqual([]);
    expect(await loadEntityOptions('project')).toEqual([]);
    expect(await loadEntityOptions('event')).toEqual([]);
  });
});
