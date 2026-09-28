import { beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());
vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery, anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })) }));

import { totalsOf } from '@/lib/explorer-query/cut';
import { figures } from '@/lib/explorer-query/visual';

// D04's form: the top 15 of 721 providers, the whole set counted in the same read
const SQL = 'SELECT provider, round(sum(usd), 2) AS value_usd, count() OVER () AS of_total FROM v GROUP BY provider ORDER BY value_usd DESC LIMIT 15';
const COLUMNS = [{ name: 'provider', type: 'Nullable(String)' }, { name: 'value_usd', type: 'Nullable(Float64)' }, { name: 'of_total', type: 'UInt64' }];
const rows = (n: number, total: (i: number) => number = () => 721) => Array.from({ length: n }, (_, i) => ({ provider: `0x${i}`, value_usd: 1000 - i, of_total: total(i) }));
const result = (r: Record<string, unknown>[]) => ({ columns: COLUMNS, rows: r, rowCount: r.length, elapsedMs: 20_574, rowsRead: 0, bytesRead: 0, truncated: false, ranAt: '' });
const SIZE = { newest: false, sum: {}, count: {}, min: {}, max: {}, distinct: {} };

describe('the totals of a cut ranking', () => {
  beforeEach(() => runQuery.mockReset());

  it('take the size the ranking counts in the same read, and read nothing again', async () => {
    expect(await totalsOf(SQL, result(rows(15)), 43114)).toEqual({ rows: 721, ...SIZE });
    // rows that only reach their LIMIT: the count says nothing was cut
    expect(await totalsOf(SQL, result(rows(15, () => 15)), 43114)).toEqual({ rows: 15, ...SIZE });
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('read the whole result again when the rows carry no count of the whole set', async () => {
    runQuery.mockResolvedValue({ columns: [], rows: [{ __rows: 721, d0: 721, s1: 5, n1: 721, lo1: 0, hi1: 1000, ha1: '0x0', la1: '0x720', s2: 1, n2: 721, lo2: 721, hi2: 721 }], rowCount: 1 });
    // a count per group, a count that differs by row or falls short of the rows, a LIMIT BY, and no window count
    const cases: [string, Record<string, unknown>[]][] = [
      [SQL.replace('OVER ()', 'OVER (PARTITION BY provider)'), rows(15)],
      [SQL, rows(15, (i) => 700 + i)],
      [SQL, rows(15, () => 10)],
      [SQL.replace(' LIMIT 15', ' LIMIT 1 BY provider LIMIT 15'), rows(15)],
      [SQL.replace('count() OVER () AS of_total', '721 AS of_total'), rows(15)],
    ];
    for (const [sql, r] of cases) {
      runQuery.mockClear();
      expect((await totalsOf(sql, result(r), 43114))?.sum, sql).toEqual({ value_usd: 5, of_total: 1 });
      expect(runQuery, sql).toHaveBeenCalledTimes(1);
    }
  });

  it('are read as the size alone: no total over the whole set is promised beside the rows', () => {
    const f = figures({ columns: COLUMNS, rows: rows(15), names: {}, x: 'provider', totals: { rows: 721, ...SIZE } });
    expect(f[0]).toBe("The rows are the first 15 of 721: the query's LIMIT cut the rest. A sum over these rows is not the total over all 721.");
    expect(f.join('\n')).not.toContain('over all 721 rows');
  });
});
