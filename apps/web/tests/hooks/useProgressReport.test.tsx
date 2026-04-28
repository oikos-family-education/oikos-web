import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressReport } from '../../hooks/useProgressReport';

const mockReport = {
  generated_at: '2024-01-31T12:00:00Z',
  range: { from: '2024-01-01', to: '2024-01-31' },
  family: { family_name: 'Smith', shield_config: null, location: null },
  children: [{ id: 'c1', first_name: 'Alice', grade_level: '3rd', is_active: true }],
  curricula: [],
  projects: [],
  teach_counts: {
    range_days: 31,
    days_with_any_log: 10,
    total_entries: 42,
    by_child: [],
    by_subject: [],
  },
};

describe('useProgressReport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in loading state with null data', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns data on successful fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockReport);
    expect(result.current.error).toBeNull();
  });

  it('sets error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to load progress report.');
  });

  it('sets error when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to load progress report.');
  });

  it('includes child_id in URL when provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result } = renderHook(() =>
      useProgressReport('2024-01-01', '2024-01-31', 'child-abc'),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('child_id=child-abc');
  });

  it('does not include child_id when not provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('child_id');
  });

  it('calls fetch with credentials: include', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result } = renderHook(() => useProgressReport('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledOptions = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(calledOptions.credentials).toBe('include');
  });

  it('re-fetches when from/to params change', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useProgressReport(from, to),
      { initialProps: { from: '2024-01-01', to: '2024-01-31' } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    rerender({ from: '2024-02-01', to: '2024-02-29' });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
