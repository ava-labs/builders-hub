import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { BurnerRow } from '@/lib/gas-burners';

// The query service runs two ad-hoc queries at once and turns a third away with a 503 ("too many ad-hoc queries in
// flight, retry shortly"). runQuery waits a few seconds and asks again; a service still busy after that is a
// QueryBusyError, and the gas page's top burners route waits it out in the request instead of failing the board.

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn(async (run: () => unknown) => run()) }));

const BUSY = JSON.stringify({ error: 'Service Unavailable', message: 'too many ad-hoc queries in flight, retry shortly' });
const REFUSED = JSON.stringify({ error: 'Bad Request', message: 'clickhouse: code: 47, message: Unknown identifier x' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('STATS_QUERY_KEY', 'test');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('@/lib/explorer-query/clickhouse');
});

describe('a busy query service', () => {
  it('is a QueryBusyError when it is still busy after the waits', async () => {
    const { QueryBusyError, runQuery } = await import('@/lib/explorer-query/clickhouse');
    const fetch = vi.fn(async () => new Response(BUSY, { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    const answer = runQuery('SELECT 7 AS n').catch((x: unknown) => x);
    await vi.runAllTimersAsync();
    const e = await answer;
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(e).toBeInstanceOf(QueryBusyError);
    expect((e as Error).message).toBe('too many ad-hoc queries in flight, retry shortly');
  });

  it('is not the answer to a query the service refuses', async () => {
    const { QueryBusyError, runQuery } = await import('@/lib/explorer-query/clickhouse');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(REFUSED, { status: 400 })));
    const e = await runQuery('SELECT x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(QueryBusyError);
  });
});

describe('the top burners route', () => {
  // one row of the 7-day board read on 2026-10-06, with no receiver, so the route reads no code from the chain
  const ROW: BurnerRow = {
    wallet: '0xb5caca56dbb4801f351871c75887c9a8361c7073',
    txs: 13645,
    burned_wei: '273460000000000000000',
    target: null,
    target_wei: '266473000000000000000',
    total_wei: '10799728438000000000000',
    total_txs: 2126067,
    wallets: 183237,
    complete: 1,
  };

  async function routeWith(runQuery: (sql: string) => Promise<unknown>) {
    vi.doMock('@/lib/explorer-query/clickhouse', async (actual) => ({
      ...(await actual<typeof import('@/lib/explorer-query/clickhouse')>()),
      runQuery,
    }));
    return import('@/app/api/explorer/[chainId]/burners/route');
  }

  const ask = (GET: Awaited<ReturnType<typeof routeWith>>['GET']) =>
    GET(new NextRequest('http://localhost/api/explorer/43114/burners?days=7'), { params: Promise.resolve({ chainId: '43114' }) });

  it('waits out a busy service and answers with the board', async () => {
    const { QueryBusyError } = await import('@/lib/explorer-query/clickhouse');
    const runQuery = vi
      .fn()
      .mockRejectedValueOnce(new QueryBusyError('too many ad-hoc queries in flight, retry shortly'))
      .mockResolvedValueOnce({ rows: [ROW] });
    const { GET } = await routeWith(runQuery);
    const res = ask(GET);
    await vi.runAllTimersAsync();
    const r = await res;
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { burners: unknown[] }).burners).toHaveLength(1);
  });

  it('reads again on the next request after a service that stayed busy, not 5 minutes later', async () => {
    const { QueryBusyError } = await import('@/lib/explorer-query/clickhouse');
    const busy = new QueryBusyError('too many ad-hoc queries in flight, retry shortly');
    const runQuery = vi.fn().mockRejectedValueOnce(busy).mockRejectedValueOnce(busy).mockRejectedValueOnce(busy).mockRejectedValueOnce(busy).mockResolvedValueOnce({ rows: [ROW] });
    const { GET } = await routeWith(runQuery);
    const first = ask(GET);
    await vi.runAllTimersAsync();
    expect((await first).status).toBeGreaterThanOrEqual(500);
    expect(runQuery).toHaveBeenCalledTimes(4);
    const second = await ask(GET);
    expect(runQuery).toHaveBeenCalledTimes(5);
    expect(second.status).toBe(200);
  });

  it('holds a read that failed for another reason for 5 minutes', async () => {
    const runQuery = vi.fn().mockRejectedValueOnce(new Error('Unknown identifier x')).mockResolvedValueOnce({ rows: [ROW] });
    const { GET } = await routeWith(runQuery);
    expect((await ask(GET)).status).toBeGreaterThanOrEqual(500);
    expect((await ask(GET)).status).toBeGreaterThanOrEqual(500);
    expect(runQuery).toHaveBeenCalledTimes(1);
  });
});
