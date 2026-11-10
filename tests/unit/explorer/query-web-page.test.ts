import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn(async (run: () => unknown) => run()) }));

import { runQuery } from '@/lib/explorer-query/clickhouse';

const PAGE = '<!DOCTYPE html><html><head><title>Access denied</title></head><body>blocked</body></html>';
const ROWS = { columns: ['n'], types: ['UInt64'], rows: [[7]], rowCount: 1, elapsedMs: 5, complete: true };

beforeEach(() => {
  vi.stubEnv('STATS_QUERY_KEY', 'test');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a web page in place of the query service's JSON (r12's H07)", () => {
  it('is asked once more, and the rows that come then are the answer', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(PAGE, { status: 403 })).mockResolvedValueOnce(new Response(JSON.stringify(ROWS)));
    vi.stubGlobal('fetch', fetch);
    const r = await runQuery('SELECT 7 AS n');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(r.rows).toEqual([{ n: 7 }]);
  });

  it('is told as the service, never as the page, when it comes again', async () => {
    const fetch = vi.fn(async () => new Response(PAGE, { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    const e = await runQuery('SELECT 7 AS n').catch((x: unknown) => x);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((e as Error).message).toBe('stats-api 403: the query service answered with a web page, not a query error, so the SQL may be right: run it again');
  });
});
