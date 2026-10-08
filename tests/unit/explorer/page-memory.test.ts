import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readJson, recall, remember } from '@/components/explorer-v2/page-data';

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
    const read = readJson('/api/evm/43114/blocks?limit=25');
    // the read in flight stands in for a second one
    expect(readJson('/api/evm/43114/blocks?limit=25')).toBe(read);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(read).resolves.toEqual({ url: '/api/evm/43114/blocks?limit=25' });
    expect(recall('/api/evm/43114/blocks?limit=25', true)?.data).toEqual({ url: '/api/evm/43114/blocks?limit=25' });
    // a moment later it is still fresh: no second read
    await expect(readJson('/api/evm/43114/blocks?limit=25')).resolves.toEqual({ url: '/api/evm/43114/blocks?limit=25' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const bad = readJson('/api/evm/43114/bad');
    await vi.runAllTimersAsync();
    await expect(bad).resolves.toBeNull();
    expect(recall('/api/evm/43114/bad', false)).toBeNull();
  });

  it('asks for soft answers, and keeps nothing from a soft miss', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ error: 'not found' }), { status: 200, headers: { 'x-status': '404' } }));
    vi.stubGlobal('fetch', fetch);
    const read = readJson('/api/evm/43114/tx/0xsoftmiss');
    await vi.runAllTimersAsync();
    await expect(read).resolves.toBeNull();
    expect(recall('/api/evm/43114/tx/0xsoftmiss', false)).toBeNull();
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('x-soft-status')).toBe('1');
  });
});
