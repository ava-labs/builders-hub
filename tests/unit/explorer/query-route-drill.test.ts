import { beforeEach, describe, expect, it, vi } from 'vitest';

const runKept = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-query/answer', () => ({ answerQuestion: vi.fn(), drillSql: vi.fn((sql: string) => ({ ok: true, sql })), keptWords: vi.fn() }));
vi.mock('@/lib/explorer-query/run-cache', () => ({ runKept }));
vi.mock('@/lib/explorer-query/visual', () => ({ designVisual: vi.fn(), writeReading: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn(), anchored: vi.fn(), indexState: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/guard', () => ({ guardSql: vi.fn((sql: string) => ({ ok: true, sql })) }));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putVisual: vi.fn(async () => {}) }));
vi.mock('@/lib/explorer-query/sources', () => ({ sourceNotes: vi.fn(async () => []) }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: vi.fn(async () => null) }));
vi.mock('@/lib/chat/rateLimit', () => ({ checkChatRateLimit: vi.fn(() => ({ allowed: true, limit: 10, resetTime: 0 })), formatResetTime: vi.fn(() => 'soon'), getClientIP: vi.fn(() => '192.0.2.1') }));
// the route sends PostHog its events after the response, which a test outside Next never has
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }));

import { POST } from '@/app/api/explorer/query/route';

const post = (drill: unknown) => POST(new Request('http://localhost/api/explorer/query', { method: 'POST', body: JSON.stringify({ chainId: 43114, drill }) }));
const DAY: [number, number] = [Date.parse('2026-09-24T00:00:00Z') / 1000, Date.parse('2026-09-25T00:00:00Z') / 1000];
const sql = "SELECT block_time AS t, concat('0x', hex(hash)) AS tx_hash, toFloat64(gas_used) * gas_price / 1e18 AS fee_avax FROM raw_txs WHERE chain_id = 43114 AND toDate(block_time) = '2026-09-24' ORDER BY fee_avax DESC LIMIT 50";
const records = { result: { columns: [], rows: [{ t: '2026-09-24 21:30:00', tx_hash: '0x1', fee_avax: 111 }], rowCount: 1, truncated: false }, anchor: null, sources: [] };
const bins = { result: { columns: [], rows: [{ bin: String(DAY[0]), n: '7629', v: 2.95 }, { bin: String(DAY[0] + 900), n: '8100', v: 3.1 }], rowCount: 2, truncated: false }, anchor: null, sources: [] };

beforeEach(() => {
  runKept.mockReset();
  runKept.mockImplementation(async (q: string) => (q.includes('GROUP BY bin') ? bins : records));
});

describe("a drill's bins", () => {
  it("read the ranked records' whole population over the opened bucket beside the records", async () => {
    const res = await post({ sql, row: {}, span: DAY });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.rows).toHaveLength(1);
    expect(body.profile).toEqual({ col: 'fee_avax', agg: 'sum', step: 900, bins: [{ t: DAY[0], n: 7629, v: 2.95 }, { t: DAY[0] + 900, n: 8100, v: 3.1 }] });
    expect(runKept).toHaveBeenCalledTimes(2);
    expect(runKept.mock.calls[1][0]).not.toMatch(/LIMIT 50/);
  });

  it('are none for a drill with no bucket, a bucket past a year, or a run of time', async () => {
    for (const drill of [{ sql, row: {} }, { sql, row: {}, span: [DAY[0], DAY[0] + 400 * 86_400] }, { sql, row: {}, span: ['a', 'b'] }, { sql: sql.replace('fee_avax DESC', 't DESC'), row: {}, span: DAY }]) {
      runKept.mockClear();
      const body = await (await post(drill)).json();
      expect(body.profile).toBeNull();
      expect(runKept).toHaveBeenCalledTimes(1);
    }
  });

  it('leave the records standing alone when their read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    runKept.mockImplementation(async (q: string) => {
      if (q.includes('GROUP BY bin')) throw new Error('timeout');
      return records;
    });
    const res = await post({ sql, row: {}, span: DAY });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toBeNull();
    expect(body.result.rows).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
