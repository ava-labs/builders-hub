import { describe, expect, it } from 'vitest';

import { NO_QUERY, cutLine } from '@/components/explorer-v2/evm/query-client';
import type { QueryResult } from '@/lib/explorer-query/clickhouse';
import { cutOf, newestSql } from '@/lib/explorer-query/cut';
import { guardSql } from '@/lib/explorer-query/guard';
import type { Totals } from '@/lib/explorer-query/types';
import { figures } from '@/lib/explorer-query/visual';

const SERIES = 'SELECT toStartOfFiveMinutes(block_time) AS t, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY GROUP BY t ORDER BY t\nLIMIT 2000';
const at = (i: number) => new Date(Date.UTC(2026, 8, 20) + i * 300_000).toISOString().slice(0, 19).replace('T', ' ');
const TIMED = [{ name: 't', type: 'DateTime' }, { name: 'txs', type: 'UInt64' }];
const result = (rows: Record<string, unknown>[], columns = TIMED): Pick<QueryResult, 'columns' | 'rows' | 'rowCount'> => ({ columns, rows, rowCount: rows.length });
const rising = (n: number) => Array.from({ length: n }, (_, i) => ({ t: at(i), txs: 100 + (i % 7) }));
const totals = (rows: number, more: Partial<Totals> = {}): Totals => ({ rows, newest: false, sum: {}, count: {}, min: {}, max: {}, distinct: {}, ...more });

describe('cutOf', () => {
  it('finds the limit a query stopped at, and only when the rows reached it', () => {
    expect(cutOf(SERIES, 2000)).toEqual({ inner: SERIES.replace('\nLIMIT 2000', ''), limit: 2000, newest: false });
    expect(cutOf(SERIES, 73)).toBeNull();
    expect(cutOf('SELECT node_id FROM p_validator_snapshots ORDER BY end_time ASC\nLIMIT 100', 100)?.limit).toBe(100);
    expect(cutOf('SELECT a, b FROM raw_txs ORDER BY b DESC LIMIT 5 BY a LIMIT 100', 100)?.inner).toBe('SELECT a, b FROM raw_txs ORDER BY b DESC LIMIT 5 BY a');
    expect(cutOf('SELECT count() FROM raw_txs', 1)).toBeNull();
  });
});

describe('newestSql', () => {
  it('keeps a rising time series its newest rows when the row cap cut it, in a query the guard passes', () => {
    const sql = newestSql(SERIES, result(rising(2000)), 't')!;
    expect(sql).toContain('ORDER BY `t` DESC LIMIT 2000) ORDER BY `t`');
    expect(guardSql(sql, 43114).ok).toBe(true);
    expect(cutOf(sql, 2000)).toEqual({ inner: SERIES.replace('\nLIMIT 2000', ''), limit: 2000, newest: true });
    // written once: its own form is never written again
    expect(newestSql(sql, result(rising(2000)), 't')).toBeNull();
  });

  it('leaves a falling series, a short one, a ranking and a model LIMIT alone', () => {
    expect(newestSql(SERIES, result(rising(2000).reverse()), 't')).toBeNull();
    expect(newestSql(SERIES, result(rising(1200)), 't')).toBeNull();
    const ranking = result(rising(2000).map((r, i) => ({ sender: `0x${i}`, txs: r.txs })), [{ name: 'sender', type: 'String' }, { name: 'txs', type: 'UInt64' }]);
    expect(newestSql(SERIES, ranking, 'sender')).toBeNull();
    expect(newestSql(SERIES.replace('LIMIT 2000', 'LIMIT 100'), result(rising(100)), 't')).toBeNull();
  });
});

describe('figures', () => {
  const columns = [{ name: 't', type: 'DateTime' }, { name: 'fees_avax', type: 'Float64' }];
  // the peak sits past the first rows a sample would show, and a lower one inside them
  const rows = Array.from({ length: 73 }, (_, i) => ({ t: at(i), fees_avax: i === 50 ? 9.074410033818316 : i === 13 ? 6.985981787865039 : 1 + (i % 5) * 0.25 }));

  it('names the true peak and its row, over all rows, in plain digits', () => {
    const f = figures({ columns, rows, names: {}, x: 't' }).join('\n');
    expect(f).toContain(`max 9.07441 at t ${at(50)}`);
    expect(f).toContain('first 1, last 1.5');
    expect(f).toContain(`from ${at(0)} to ${at(72)}`);
    expect(f).not.toMatch(/\de[+-]\d/);
  });

  it('names the next highest rows too, for a peak in a bucket still filling', () => {
    const filling = rows.map((x, i) => (i === 72 ? { ...x, fees_avax: 9.39 } : x));
    const f = figures({ columns, rows: filling, names: {}, x: 't' }).join('\n');
    expect(f).toContain(`max 9.39 at t ${at(72)}, then 9.07441 at t ${at(50)} and 6.98598 at t ${at(13)}`);
  });

  it('says a cut first, and sets the whole result beside the rows', () => {
    const t = totals(142, { sum: { fees_avax: 500 }, count: { fees_avax: 142 }, min: { fees_avax: 0.5 }, max: { fees_avax: 12 }, distinct: { t: 142 } });
    const f = figures({ columns, rows, names: {}, x: 't', totals: t });
    expect(f[0]).toBe("The rows are the first 73 of 142: the query's LIMIT cut the rest. A sum over these rows is not the total; the total over all 142 is given beside it.");
    const text = f.join('\n');
    expect(text).toContain('total 500 over all 142 rows');
    expect(text).toContain('(12 in a row not shown)');
    expect(text).toContain('142 distinct over all 142 rows (73 here)');
    expect(figures({ columns, rows, names: {}, x: 't', totals: totals(142, { newest: true }) })[0]).toBe('The rows are the newest 73 of 142: the row cap cut the oldest.');
  });
});

describe('cutLine', () => {
  const r = (rowCount: number, truncated = false) => ({ columns: [], rows: [], rowCount, elapsedMs: 0, rowsRead: 0, bytesRead: 0, truncated, ranAt: '' });

  it('says what the rows shown are of the whole answer', () => {
    expect(cutLine({ result: r(100), totals: totals(142) })).toBe('100 of 142 rows');
    expect(cutLine({ result: r(2000, true), totals: totals(2016, { newest: true }) })).toBe('The newest 2,000 of 2,016 rows');
    expect(cutLine({ result: r(2000, true), totals: null })).toBe('The first 2,000 rows; the query has more');
    expect(cutLine({ result: r(73), totals: null })).toBeNull();
    // rows that only reach their LIMIT leave nothing out
    expect(cutLine({ result: r(288, true), totals: totals(288) })).toBeNull();
    expect(cutLine({ result: null })).toBeNull();
    expect(NO_QUERY).toBe('No query ran for this question.');
  });
});
