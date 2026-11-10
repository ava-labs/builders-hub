import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { anchored } from '@/lib/explorer-query/clickhouse';

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const sql = (chainId: number) => `SELECT count() AS txs FROM raw_txs WHERE chain_id = ${chainId} AND block_time >= now() - INTERVAL 1 HOUR`;

// the query service answers the index's coverage (its last block at lastBlock), and the chain's RPC its newest block
function world(lastBlock: number, head: number | 'down') {
  return vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes('stats-api')) {
      return Response.json({ columns: ['since', 'until', 'until_unix', 'lo', 'hi', 'blocks'], types: ['String', 'String', 'UInt32', 'UInt64', 'UInt64', 'UInt64'], rows: [['2025-01-01 00:00:00', iso(lastBlock), Math.floor(lastBlock / 1000), 1, 900, 900]], rowCount: 1, elapsedMs: 1, complete: true });
    }
    if (head === 'down') throw new Error('connect refused');
    return Response.json({ jsonrpc: '2.0', id: 1, result: { number: '0x384', timestamp: `0x${Math.floor(head / 1000).toString(16)}` } });
  });
}
const rpcCalls = (f: ReturnType<typeof world>) => f.mock.calls.filter(([url]) => !String(url).includes('stats-api')).length;

beforeEach(() => {
  vi.stubEnv('STATS_QUERY_KEY', 'test-key');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("now() on a chain whose index's last block is old", () => {
  const behind = Date.now() - 30 * 60_000;

  it('stays now when the index holds the chain’s newest block: the chain is quiet, not the index late', async () => {
    // FIFA makes about 31 blocks a day: its last block, indexed, was the chain's newest
    const f = world(behind, behind);
    vi.stubGlobal('fetch', f);
    const a = await anchored(sql(13322), 13322);
    expect(a.anchor).toBeNull();
    expect(a.sql).toContain('now() - INTERVAL 1 HOUR');
    expect(rpcCalls(f)).toBe(1);
  });

  it('moves to the last indexed block when the chain made blocks since', async () => {
    vi.stubGlobal('fetch', world(behind, Date.now() - 5_000));
    const a = await anchored(sql(4337), 4337);
    expect(a.anchor).toBe(iso(behind));
    expect(a.sql).toContain(`toDateTime(${Math.floor(behind / 1000)}) - INTERVAL 1 HOUR`);
  });

  it('moves to the last indexed block, as before, when the chain’s RPC does not answer', async () => {
    vi.stubGlobal('fetch', world(behind, 'down'));
    expect((await anchored(sql(432204), 432204)).anchor).toBe(iso(behind));
  });

  it('asks no RPC when the index is current', async () => {
    const f = world(Date.now() - 60_000, 'down');
    vi.stubGlobal('fetch', f);
    expect((await anchored(sql(43419), 43419)).anchor).toBeNull();
    expect(rpcCalls(f)).toBe(0);
  });
});
