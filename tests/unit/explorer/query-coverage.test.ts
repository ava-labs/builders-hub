import { afterEach, describe, expect, it, vi } from 'vitest';

import { coverage, indexState } from '@/lib/explorer-query/clickhouse';

// the coverage row as the query service returns it, after a wait that outlasts the route's own
const answer = (ms: number) =>
  vi.fn(async () => {
    await new Promise((r) => setTimeout(r, ms));
    return Response.json({ columns: ['since', 'until', 'until_unix', 'lo', 'hi', 'blocks'], types: ['String', 'String', 'UInt32', 'UInt64', 'UInt64', 'UInt64'], rows: [['2026-01-01 00:00:00', '2026-09-29 07:00:00', 1790665200, 1, 900, 900]], rowCount: 1, elapsedMs: ms, complete: true });
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("a chain's coverage", () => {
  it('is read once while a read is still running, even after the route stops waiting for it', async () => {
    vi.stubEnv('STATS_QUERY_KEY', 'test-key');
    vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
    const fetchMock = answer(60);
    vi.stubGlobal('fetch', fetchMock);
    // the route waits 5 ms here, then the answer asks for the same chain
    expect(await indexState(990001, 5)).toBeNull();
    const [a, b] = await Promise.all([coverage(990001), coverage(990001)]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(a).toEqual(b);
    expect(a).toMatchObject({ until: '2026-09-29 07:00:00', blocks: 900 });
    // and kept after it ends
    expect(await coverage(990001)).toEqual(a);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('is read again after a read that failed', async () => {
    vi.stubEnv('STATS_QUERY_KEY', 'test-key');
    vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    expect(await coverage(990002)).toBeNull();
    const fetchMock = answer(1);
    vi.stubGlobal('fetch', fetchMock);
    expect(await coverage(990002)).toMatchObject({ blocks: 900 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
