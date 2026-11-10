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

describe('a NULL in any other type the driver does not clear', () => {
  const types: [string, string][] = [
    ['n', 'UInt8'],
    ['lcs', 'LowCardinality(Nullable(String))'],
    ['lcu', 'LowCardinality(Nullable(UInt64))'],
    ['b', 'Nullable(Bool)'],
    ['id', 'Nullable(UUID)'],
    ['e', "Nullable(Enum8('a' = 1, 'b' = 2))"],
  ];

  it('comes back NULL: a LowCardinality column read again as its plain type, the rest as text, each with its type', async () => {
    // the endpoint as it is (qdata/nullfix2/types2.out): a NULL in these types repeats the row before; Enum is right
    const sent = endpoint(
      answer(types, [
        [1, '1001', 1001, true, '00000000-0000-0000-0000-000000000001', 'a'],
        [2, '1001', 1001, true, '00000000-0000-0000-0000-000000000001', null],
        [3, '1003', 1003, false, '00000000-0000-0000-0000-000000000003', 'b'],
      ]),
      answer(
        [
          ['n', 'UInt8'],
          ['lcs', 'Nullable(String)'],
          ['lcu', 'Nullable(UInt64)'],
          ['b', 'Nullable(String)'],
          ['id', 'Nullable(String)'],
          ['e', "Nullable(Enum8('a' = 1, 'b' = 2))"],
        ],
        [
          [1, '1001', 1001, 'true', '00000000-0000-0000-0000-000000000001', 'a'],
          [2, null, null, null, null, null],
          [3, '1003', 1003, 'false', '00000000-0000-0000-0000-000000000003', 'b'],
        ],
      ),
    );
    const r = await runQuery('SELECT n, lcs, lcu, b, id, e FROM t');
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(
      'SELECT `n`, CAST(`lcs` AS Nullable(String)) AS `lcs`, CAST(`lcu` AS Nullable(UInt64)) AS `lcu`, toString(`b`) AS `b`, toString(`id`) AS `id`, `e` FROM (SELECT n, lcs, lcu, b, id, e FROM t)',
    );
    expect(r.rows).toEqual([
      { n: 1, lcs: '1001', lcu: 1001, b: true, id: '00000000-0000-0000-0000-000000000001', e: 'a' },
      { n: 2, lcs: null, lcu: null, b: null, id: null, e: null },
      { n: 3, lcs: '1003', lcu: 1003, b: false, id: '00000000-0000-0000-0000-000000000003', e: 'b' },
    ]);
    expect(r.columns).toEqual(types.map(([name, type]) => ({ name, type })));
  });

  it('is asked for once when the driver clears every nullable column', async () => {
    const safe: [string, string][] = [
      ['e', "Nullable(Enum8('a' = 1))"],
      ['d', 'Nullable(Date32)'],
      ['t', "Nullable(DateTime64(3, 'UTC'))"],
      ['f', 'Nullable(Float64)'],
      ['z', 'Nullable(Nothing)'],
      ['s', 'LowCardinality(String)'],
    ];
    const sent = endpoint(answer(safe, [['a', null, null, 1.5, null, 'x']]));
    const r = await runQuery('SELECT e, d, t, f, z, s FROM t');
    expect(sent).toHaveLength(1);
    expect(r.rows).toEqual([{ e: 'a', d: null, t: null, f: 1.5, z: null, s: 'x' }]);
  });
});

describe('an answer the query service cut off', () => {
  it('reads as a NaN or an infinity, with how to write the query instead', async () => {
    // the endpoint as it is (qdata/flows/inf.sql): an infinity in the third row ends the body after its header
    endpoint(new Response('{"columns":["n","r"]\n,"types":["UInt64","Float64"]\n,"rows":['));
    await expect(runQuery('SELECT number AS n, 1 / (toInt64(number) - 2) AS r FROM numbers(4)')).rejects.toThrow(
      'the query service cut its answer off, as it does when a value is NaN or infinite: divide by nullIf(x, 0), and wrap ratios and quantiles in ifNotFinite(x, NULL)',
    );
    // any other body that is not JSON keeps its status and text
    endpoint(new Response('<html>Bad Gateway</html>', { status: 502 }));
    await expect(runQuery('SELECT 1')).rejects.toThrow('stats-api 502: <html>Bad Gateway</html>');
  });
});
