import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prefetchJson, recall, remember } from '@/components/explorer-v2/page-data';

// the memory only answers in a browser
beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the explorer memory', () => {
  it('shows a polled list while it is young and a record for longer', () => {
    remember('/api/evm/43114/txs?limit=11', { rows: 11 });
    remember('/api/evm/43114/tx/0xabc', { hash: '0xabc' });
    vi.advanceTimersByTime(29_000);
    expect(recall('/api/evm/43114/txs?limit=11', true)?.data).toEqual({ rows: 11 });
    vi.advanceTimersByTime(2_000);
    expect(recall('/api/evm/43114/txs?limit=11', true)).toBeNull();
    expect(recall('/api/evm/43114/tx/0xabc', false)?.data).toEqual({ hash: '0xabc' });
    vi.advanceTimersByTime(10 * 60_000);
    expect(recall('/api/evm/43114/tx/0xabc', false)).toBeNull();
  });

  it('forgets the least recent past its cap', () => {
    for (let i = 0; i < 81; i++) remember(`/api/cap/${i}`, i);
    expect(recall('/api/cap/0', false)).toBeNull();
    expect(recall('/api/cap/1', false)?.data).toBe(1);
    expect(recall('/api/cap/80', false)?.data).toBe(80);
  });

  it('reads a hovered link once, and keeps nothing from a failed read', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/bad') ? new Response('no', { status: 502 }) : new Response(JSON.stringify({ url }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetch);
    prefetchJson('/api/evm/43114/blocks?limit=25');
    prefetchJson('/api/evm/43114/blocks?limit=25');
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(recall('/api/evm/43114/blocks?limit=25', true)?.data).toEqual({ url: '/api/evm/43114/blocks?limit=25' });
    // a moment later it is still fresh: no second read
    prefetchJson('/api/evm/43114/blocks?limit=25');
    expect(fetch).toHaveBeenCalledTimes(1);
    prefetchJson('/api/evm/43114/bad');
    await vi.runAllTimersAsync();
    expect(recall('/api/evm/43114/bad', false)).toBeNull();
  });
});
