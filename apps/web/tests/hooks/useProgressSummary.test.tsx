import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressSummary } from '../../hooks/useProgressSummary';

const mockSummary = {
  range: { from: '2024-01-01', to: '2024-01-31' },
  overall_streak: {
    current_weeks: 3,
    longest_weeks: 5,
    weekly_target: 4,
    this_week_count: 2,
    last_met_week_start: null,
  },
  per_child_streaks: [],
  per_subject_streaks: [],
  teach_counts: {
    total: 12,
    by_child: [],
    by_subject: [],
  },
  heatmap: [],
};

describe('useProgressSummary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in loading state', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets data on successful fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockSummary);
    expect(result.current.error).toBeNull();
  });

  it('sets error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to load progress summary.');
  });

  it('sets error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to load progress summary.');
  });

  it('includes child_id in URL when provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() =>
      useProgressSummary('2024-01-01', '2024-01-31', 'child-uuid-123'),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('child_id=child-uuid-123');
  });

  it('does not include child_id in URL when not provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('child_id');
  });

  it('calls fetch with credentials: include', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledOptions = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(calledOptions.credentials).toBe('include');
  });

  it('refetch re-executes the fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const { result } = renderHook(() => useProgressSummary('2024-01-01', '2024-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    result.current.refetch();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
