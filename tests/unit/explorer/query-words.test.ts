import { describe, expect, it } from 'vitest';

import { ROW_CAP, progress, readerError, reads, rowsLabel, withEdges } from '@/components/explorer-v2/evm/query-client';
import type { QueryEvent } from '@/lib/explorer-query/answer';
import { MAX_ROWS } from '@/lib/explorer-query/guard';
import type { Totals } from '@/lib/explorer-query/types';
import { codeWords, figures, plainLabel, readerSpec, sampleOf, sqlNames, withoutCode, type VisualSpec } from '@/lib/explorer-query/visual';

const totals = (rows: number): Totals => ({ rows, newest: false, sum: {}, count: {}, min: {}, max: {}, distinct: {} });
const result = (rows: Record<string, unknown>[], truncated = false) => ({ columns: [], rows, rowCount: rows.length, elapsedMs: 0, rowsRead: 0, bytesRead: 0, truncated, ranAt: '' });

describe('the cap in words', () => {
  it('keeps the page cap equal to the engine cap', () => {
    expect(ROW_CAP).toBe(MAX_ROWS);
  });

  it('says so in the loader when the rows reach the cap', () => {
    const final: QueryEvent = { type: 'step', n: 1, kind: 'final', writer: 'W', modelMs: 1, sqlMs: 1, ok: true, detail: '2000 rows' };
    expect(progress([final])).toBe('Reading 2,000 rows, the most one answer holds');
  });

  it('counts the rows sheet against the whole answer', () => {
    expect(rowsLabel({ result: result([]), totals: totals(2016) }, 2000)).toBe('2,000 of 2,016');
    expect(rowsLabel({ result: result([], true), totals: null }, 2000)).toBe('2,000, capped');
    expect(rowsLabel({ result: result([]), totals: null }, 42)).toBe('42');
    expect(rowsLabel({ result: result([], true), totals: totals(288) }, 288)).toBe('288');
  });
});

describe('readerError', () => {
  it('keeps the engine words out of the reader text', () => {
    expect(readerError('Code: 241. DB::Exception: Memory limit exceeded')).toBe('The database stopped before the answer was complete. Try again in a minute.');
    expect(readerError('stats-api 503: too many ad-hoc queries in flight')).toBe('The database stopped before the answer was complete. Try again in a minute.');
    expect(readerError('The answer stopped before it finished.')).toBe('The answer was cut off on its way. Try again.');
    expect(readerError('Sign in to ask more questions today.')).toBe('Sign in to ask more questions today.');
  });
});

describe('reads', () => {
  it('writes bare figures of five digits or more with separators, and leaves the rest', () => {
    expect(reads(['Validators moved 14302 txs in block 96233283 at 22:05 on 2026-09-27'])).toBe('Validators moved 14,302 txs in block 96,233,283 at 22:05 on 2026-09-27.');
    expect(reads(['0x1234567890123456789012345678901234567890 sent 2810 txs'])).toBe('0x1234…7890 sent 2810 txs.');
  });
});

describe('withEdges', () => {
  const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
  const rows = [20, 21, 22, 23, 24, 25, 26, 27].map((d) => ({ day: day(d), txs: 100 }));
  const visual: VisualSpec = { stats: [], callouts: [], panels: [{ title: 'Daily', kind: 'bar', x: 'day', series: [{ column: 'txs', label: 'Txs', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc', referenceLines: [], width: 'full' }] };
  const answer = { sql: 'SELECT toDate(block_time) AS day, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY GROUP BY day ORDER BY day', anchor: '2026-09-27 03:20:23.000', result: result(rows) };

  it('labels the first bucket the window cuts through, and the last one still filling', () => {
    const out = withEdges(visual, answer)!;
    expect(out.panels[0].markers).toEqual([{ x: day(20), label: 'partial' }, { x: day(27), label: 'so far' }]);
  });

  it('leaves a window with no now() alone', () => {
    expect(withEdges(visual, { ...answer, sql: answer.sql.replace('now() - INTERVAL 7 DAY', "'2026-09-20'") })).toBe(visual);
  });
});

describe('sampleOf', () => {
  it('shows a model the head, the tail, and each column’s highest and lowest row', () => {
    const columns = [{ name: 't', type: 'DateTime' }, { name: 'fees', type: 'Float64' }];
    const rows = Array.from({ length: 200 }, (_, i) => ({ t: `2026-09-26 ${String(Math.floor(i / 12)).padStart(2, '0')}:${String((i % 12) * 5).padStart(2, '0')}:00`, fees: i === 123 ? 99 : i === 77 ? 0.01 : 1 }));
    const s = sampleOf({ columns, rows, names: {}, x: 't' });
    const at = s.rows.map((r) => rows.findIndex((x) => x.t === r.t));
    for (const i of [0, 4, 195, 199, 123, 77]) expect(at).toContain(i);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});

describe('reader words', () => {
  const sql = "SELECT subnet_id, topic0, sum(seats) AS validators, sum(seen_week) AS seen_7d FROM p_validator_versions WHERE version = 'v1.15' -- ERC20 seats\nGROUP BY subnet_id, topic0";

  it('finds the names of the SQL in reader text, and nothing else', () => {
    const own = sqlNames(sql);
    expect(own).toEqual(['topic0']);
    expect(codeWords('L1s by version; seen_7d counts the seats seen this week.', own)).toEqual(['seen_7d']);
    expect(codeWords('Grouped by topic0 on each L1, over 24h.', own)).toEqual(['topic0']);
    expect(codeWords('10 of 66 L1s run 1.15 on the P-Chain; ERC20 tokens move on the C-Chain.', own)).toEqual([]);
  });

  it('leaves out a sentence that names one, and reads a label as words', () => {
    expect(withoutCode('Seats per L1 by version line. seen_7d counts the seats seen in the last 7 days.', sqlNames(sql))).toBe('Seats per L1 by version line.');
    expect(withoutCode('Nothing to leave out.\nTwo lines stay two lines.')).toBe('Nothing to leave out.\nTwo lines stay two lines.');
    expect(plainLabel('Seats seen_7d')).toBe('Seats seen 7d');
  });

  it('keeps the columns out of a layout', () => {
    const v: VisualSpec = {
      stats: [{ label: 'seen_7d', column: 'seen_7d', agg: 'sum', format: 'number' }],
      panels: [
        {
          title: 'Validators by L1',
          kind: 'hbar',
          x: 'subnet_id',
          series: [{ column: 'validators', label: 'validators', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }],
          markers: [],
          bands: [],
          stacked: false,
          sortDir: 'desc',
          referenceLines: [],
          width: 'full',
        },
      ],
      callouts: ['Only 1 to_address received the fees.', 'Avalanche runs 1.15 on 60 of 66 L1s.'],
    };
    const out = readerSpec(v, ['subnet_id', 'validators', 'seen_7d']);
    expect(out.stats[0].label).toBe('seen 7d');
    expect(out.stats[0].column).toBe('seen_7d');
    expect(out.panels[0].series[0].column).toBe('validators');
    expect(out.callouts).toEqual(['Avalanche runs 1.15 on 60 of 66 L1s.']);
  });

  it('says the answer is reworded in the loader, and counts no SQL fix', () => {
    const words: QueryEvent = { type: 'step', n: 1, kind: 'final', writer: 'W', modelMs: 1, sqlMs: 0, ok: false, detail: 'reader words: seen_7d' };
    const bad: QueryEvent = { type: 'step', n: 2, kind: 'final', writer: 'W', modelMs: 1, sqlMs: 0, ok: false, detail: 'Code: 47. Unknown identifier' };
    expect(progress([words])).toBe('Rewording the answer');
    expect(progress([words, bad])).toBe('Fixing the SQL');
  });
});

describe('figures', () => {
  it('gives a figure the same in every row once, never its sum', () => {
    const f = figures({
      columns: [
        { name: 'subnet_id', type: 'String' },
        { name: 'validators', type: 'UInt64' },
        { name: 'of_total', type: 'UInt64' },
      ],
      rows: [
        { subnet_id: 'a', validators: 40, of_total: 66 },
        { subnet_id: 'b', validators: 12, of_total: 66 },
        { subnet_id: 'c', validators: 5, of_total: 66 },
      ],
      names: {},
    });
    expect(f).toContain('of_total (UInt64): 66 in every row');
    expect(f.find((l) => l.startsWith('validators'))).toContain('total 57');
  });
});
