import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn() }));

import { runQuery } from '@/lib/explorer-query/clickhouse';

/** a /v2/query answer: columns, their types and the rows */
const answer = (types: [string, string][], rows: unknown[][]) =>
  new Response(JSON.stringify({ columns: types.map(([n]) => n), types: types.map(([, t]) => t), rows, rowCount: rows.length, truncated: false, elapsedMs: 5, complete: true }));

/** each SQL the endpoint was sent, answered in turn */
function endpoint(...answers: Response[]) {
  const sent: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).sql);
      return answers[sent.length - 1];
    }),
  );
  return sent;
}

beforeEach(() => {
  vi.stubEnv('STATS_QUERY_KEY', 'test');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a NULL in a big integer or decimal column', () => {
  const types: [string, string][] = [
    ['n', 'UInt8'],
    ['u256', 'Nullable(UInt256)'],
    ['i128', 'Nullable(Int128)'],
    ['d', 'Nullable(Decimal(38, 2))'],
    ['u64', 'Nullable(UInt64)'],
  ];

  it('comes back NULL: those columns are read again as text, and keep their types', async () => {
    // the endpoint as it is: a NULL in these types repeats the row before (stats-api query.go)
    const sent = endpoint(
      answer(types, [
        [1, 1001, -1001, '1001.5', 1001],
        [2, 1001, -1001, '1001.5', null],
        [3, 1003, -1003, '1003', 1003],
      ]),
      answer(
        types.map(([n, t]) => [n, t === 'Nullable(UInt64)' || t === 'UInt8' ? t : 'Nullable(String)']),
        [
          [1, '1001', '-1001', '1001.5', 1001],
          [2, null, null, null, null],
          [3, '1003', '-1003', '1003', 1003],
        ],
      ),
    );
    const r = await runQuery("SELECT n, if(n % 2 = 0, NULL, toUInt256(n + 1000)) AS u256 FROM t\nLIMIT 2000");
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(
      "SELECT `n`, toString(`u256`) AS `u256`, toString(`i128`) AS `i128`, toString(`d`) AS `d`, `u64` FROM (SELECT n, if(n % 2 = 0, NULL, toUInt256(n + 1000)) AS u256 FROM t LIMIT 2000)",
    );
    expect(r.rows).toEqual([
      { n: 1, u256: 1001, i128: -1001, d: '1001.5', u64: 1001 },
      { n: 2, u256: null, i128: null, d: null, u64: null },
      { n: 3, u256: 1003, i128: -1003, d: '1003', u64: 1003 },
    ]);
    expect(r.columns).toEqual(types.map(([name, type]) => ({ name, type })));
  });

  it('is asked for once when no column has those types, or they are not nullable', async () => {
    const sent = endpoint(answer([['u256', 'UInt256'], ['u64', 'Nullable(UInt64)']], [[1001, null]]));
    const r = await runQuery('SELECT toUInt256(1001) AS u256, NULL::Nullable(UInt64) AS u64');
    expect(sent).toHaveLength(1);
    expect(r.rows).toEqual([{ u256: 1001, u64: null }]);
  });
});
