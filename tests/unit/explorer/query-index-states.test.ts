import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The network Query page shows each chain's indexed window. Every caller of the site shares the stats-api key's reads
// (60 a minute per replica), so a cold page reads its EVM chains' windows in one grouped read, not one read per chain.

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn(async (run: () => unknown) => run()) }));

const COLUMNS = ['chain_id', 'since', 'until', 'until_unix', 'lo', 'hi', 'blocks'];
const TYPES = ['UInt64', 'String', 'String', 'UInt32', 'UInt64', 'UInt64', 'UInt64'];

function answer(rows: unknown[][]): Response {
  return new Response(JSON.stringify({ columns: COLUMNS, types: TYPES, rows, rowCount: rows.length, truncated: false, elapsedMs: 5, complete: true }));
}

beforeEach(() => {
  vi.stubEnv('STATS_QUERY_KEY', 'test');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('indexStates', () => {
  it('reads every cold EVM chain in one read, and a chain with no rows is empty', async () => {
    const { indexStates } = await import('@/lib/explorer-query/clickhouse');
    const fetch = vi.fn(async () => answer([[43114, '2020-09-23 11:02:19', '2026-10-26 17:00:00', 1793034000, 1, 70000000, 70000000]]));
    vi.stubGlobal('fetch', fetch);

    const states = await indexStates([0, 43114, 8021, 432204]);

    expect(fetch).toHaveBeenCalledTimes(1);
    const sql = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).sql as string;
    expect(sql).toContain('chain_id IN (43114, 8021, 432204) GROUP BY chain_id');
    expect(states[0]).toBeNull();
    expect(states[1]).toMatchObject({ until: '2026-10-26 17:00:00', hi: 70000000 });
    expect(states[2]).toBe('empty');
    expect(states[3]).toBe('empty');

    // kept: the next render reads nothing
    await indexStates([43114, 8021]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('is null for each chain when the grouped read fails, and asks again on the next render', async () => {
    const { indexStates } = await import('@/lib/explorer-query/clickhouse');
    const refused = JSON.stringify({ error: 'Bad Request', message: 'clickhouse: code: 60, message: Unknown table' });
    const fetch = vi.fn(async () => new Response(refused, { status: 400 }));
    vi.stubGlobal('fetch', fetch);

    expect(await indexStates([43114, 8021])).toEqual([null, null]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await indexStates([43114, 8021]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
