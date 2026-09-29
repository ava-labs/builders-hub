import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROW_CAP, noteParts, progress, readerError, reads, rowsLabel, withEdges } from '@/components/explorer-v2/evm/query-client';
import { edgesOf, windowOf } from '@/lib/explorer-query/edges';
import type { QueryEvent } from '@/lib/explorer-query/answer';
import { MAX_ROWS } from '@/lib/explorer-query/guard';
import type { Totals } from '@/lib/explorer-query/types';
import { codeWords, figures, plainLabel, plainWords, readerSpec, rowWords, sampleOf, shownLength, sqlNames, withFullHex, withoutCode, type VisualSpec } from '@/lib/explorer-query/visual';

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
    expect(reads(['0x1234567890123456789012345678901234567890 sent 2810 txs'])).toBe('0x1234…7890 sent 2,810 txs.');
  });

  it('writes decimals to three figures, four digits with separators, and times to the minute; a year stays a year', () => {
    expect(reads(['9.39486 AVAX burned at 05:35:00 on Sep 27 was the highest of 231.555 AVAX total', '2095 transactions at 00:05:00'])).toBe('9.39 AVAX burned at 05:35 on Sep 27 was the highest of 232 AVAX total. 2,095 transactions at 00:05.');
    expect(reads(['Since Sep 27, 2026, 1405 senders paid 0.006 AVAX in 2026 under EIP-1559, at 05:36:38'])).toBe('Since Sep 27, 2026, 1,405 senders paid 0.006 AVAX in 2026 under EIP-1559, at 05:36:38.');
    expect(reads(['Fees fell on September 27, 2026', 'The smallest fee was 0.00000012 AVAX'])).toBe('Fees fell on September 27, 2026. The smallest fee was 0.00000012 AVAX.');
  });

  it('shortens a hash the way it shortens an address', () => {
    expect(reads([`Tx 0x${'ab'.repeat(32)} reverted`])).toBe('Tx 0xabab…abab reverted.');
  });
});

describe('noteParts', () => {
  it('cuts a note around each address or hash the writer named in full', () => {
    const a = '0xB2F0B64B6AAD197151D7BCCA515E135C65039E12';
    expect(noteParts(`Fees paid to ${a}.`)).toEqual([{ text: 'Fees paid to ' }, { text: '0xb2f0…9e12', hex: a.toLowerCase() }, { text: '.' }]);
    expect(noteParts(`Tx 0x${'ab'.repeat(32)} reverted`)[1]).toEqual({ text: '0xabab…abab', hex: `0x${'ab'.repeat(32)}` });
    expect(noteParts('No address here.')).toEqual([{ text: 'No address here.' }]);
  });
});

describe('withEdges', () => {
  const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
  const rows = [20, 21, 22, 23, 24, 25, 26, 27].map((d) => ({ day: day(d), txs: 100 }));
  const visual: VisualSpec = { stats: [], callouts: [], panels: [{ title: 'Daily', kind: 'bar', x: 'day', series: [{ column: 'txs', label: 'Txs', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc', referenceLines: [], width: 'full' }] };
  const answer = { sql: 'SELECT toDate(block_time) AS day, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY GROUP BY day ORDER BY day', anchor: '2026-09-27 03:20:23.000', result: result(rows) };
  // read twenty minutes after the index's last block
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T03:40:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('labels the first bucket the window cuts through, and the last one still filling', () => {
    const out = withEdges(visual, answer)!;
    expect(out.panels[0].markers).toEqual([{ x: day(20), label: 'partial' }, { x: day(27), label: 'so far' }]);
  });

  it("labels a stale index's last bucket where the index ends", () => {
    vi.setSystemTime(new Date('2026-11-26T03:40:00Z'));
    expect(withEdges(visual, answer)!.panels[0].markers).toEqual([{ x: day(20), label: 'partial' }, { x: day(27), label: 'index ends' }]);
  });

  it('leaves a window with no now() alone', () => {
    expect(withEdges(visual, { ...answer, sql: answer.sql.replace('now() - INTERVAL 7 DAY', "'2026-09-20'") })).toBe(visual);
  });

  it('labels only the last bucket of a window that starts on a bucket edge', () => {
    const out = withEdges(visual, { ...answer, sql: answer.sql.replace('now() - INTERVAL 7 DAY', 'toStartOfDay(now()) - INTERVAL 7 DAY') })!;
    expect(out.panels[0].markers).toEqual([{ x: day(27), label: 'so far' }]);
  });

  it('reads the window a query ends now: on a bucket edge, inside one, or none', () => {
    const now = Date.parse('2026-09-27T06:10:00Z');
    const days = [20, 21, 22, 23, 24, 25, 26, 27].map(day);
    expect(edgesOf(days, windowOf('WHERE block_time >= toStartOfDay(now()) - INTERVAL 7 DAY', null, now)!)).toEqual({ lo: 0, hi: 7, first: false, last: true });
    expect(edgesOf(days, windowOf('WHERE block_time >= now() - INTERVAL 7 DAY', null, now)!)).toEqual({ lo: 0, hi: 7, first: true, last: true });
    expect(windowOf('WHERE toDate(block_time) >= today() - 7', null, now)!.start).toBe(Date.parse('2026-09-20T00:00:00Z'));
    expect(windowOf('WHERE block_time >= now() - 7', null, now)).toBeNull();
  });

  it('reads a calendar window that runs to now: this month, this week, today', () => {
    // a Tuesday: the audit's V11 read GUNZ this month, and V13 Dexalot this week
    const now = Date.parse('2026-09-29T09:55:15Z');
    expect(windowOf('WHERE block_time >= toStartOfMonth(now())', null, now)).toEqual({ start: Date.parse('2026-09-01T00:00:00Z'), end: now });
    expect(windowOf('WHERE block_time >= toMonday(now())', null, now)!.start).toBe(Date.parse('2026-09-28T00:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfWeek(now(), 1)', null, now)!.start).toBe(Date.parse('2026-09-28T00:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfWeek(now())', null, now)!.start).toBe(Date.parse('2026-09-27T00:00:00Z'));
    expect(windowOf('WHERE toDate(block_time) >= today()', null, now)!.start).toBe(Date.parse('2026-09-29T00:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfDay(now())', null, now)!.start).toBe(Date.parse('2026-09-29T00:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfHour(now())', null, now)!.start).toBe(Date.parse('2026-09-29T09:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfQuarter(now())', null, now)!.start).toBe(Date.parse('2026-07-01T00:00:00Z'));
    expect(windowOf('WHERE block_time >= toStartOfYear(now())', null, now)!.start).toBe(Date.parse('2026-01-01T00:00:00Z'));
    // the month's first day is whole, and its last still fills
    const days = Array.from({ length: 29 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    expect(edgesOf(days, windowOf('WHERE block_time >= toStartOfMonth(now())', null, now)!)).toEqual({ lo: 0, hi: 28, first: false, last: true });
    // two rows are enough: this week on a Tuesday is a whole Monday and a Tuesday still filling (the audit's V13)
    expect(edgesOf(['2026-09-28', '2026-09-29'], windowOf('WHERE block_time >= toMonday(now())', null, now)!)).toEqual({ lo: 0, hi: 1, first: false, last: true });
    expect(edgesOf(['2026-09-29'], windowOf('WHERE block_time >= toMonday(now())', null, now)!)).toBeNull();
    // a window of an index that ended on an earlier day ends there
    expect(windowOf('WHERE block_time >= toMonday(now())', '2026-09-24 12:00:00', now)).toEqual({ start: Date.parse('2026-09-21T00:00:00Z'), end: Date.parse('2026-09-24T12:00:00Z') });
    // a subtraction from a calendar start is not read as one, and a calendar start that bounds nothing is no window
    expect(windowOf('WHERE block_time >= toStartOfMonth(now()) - INTERVAL 11 MONTH', null, now)).toBeNull();
    expect(windowOf('SELECT toStartOfMonth(now()) AS m, count() FROM raw_txs WITH FILL TO toDate(now()) + 1', null, now)).toBeNull();
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

  it('shows every row up to 100', () => {
    const columns = [{ name: 'block_number', type: 'UInt32' }, { name: 'gas', type: 'UInt64' }];
    const rows = Array.from({ length: 100 }, (_, i) => ({ block_number: 96_000_000 + i, gas: i }));
    const s = sampleOf({ columns, rows, names: {}, x: 'block_number' });
    expect(s.head).toBe('All 100 rows:');
    expect(s.rows).toHaveLength(100);
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

  it('finds a comparison, and leaves out only the parentheses around one', () => {
    expect(codeWords('Active seats now (balance > 0), by L1.')).toEqual(['balance > 0']);
    expect(codeWords("Seats where version = 'Unknown' stay in the set.")).toEqual(["version = 'Unknown'"]);
    expect(withoutCode('Active L1 validator seats now (balance > 0), showing the AVAX left for fees.')).toBe('Active L1 validator seats now, showing the AVAX left for fees.');
    expect(withoutCode('Seats count when balance > 0. The rest stay.')).toBe('The rest stay.');
  });

  it('flags settled, drops its sentence from a note, and reads it as final in a label', () => {
    expect(codeWords('Count of all transactions settled each day.')).toEqual(['settled']);
    expect(withoutCode('Count of all transactions settled each day. The current day is not over.')).toBe('The current day is not over.');
    expect(plainLabel('Settled txs')).toBe('Final txs');
  });

  it('never flags a bucket, and reads it as a period in titles, notes, labels and callouts', () => {
    expect(codeWords('The current 5-minute bucket is still in progress.')).toEqual([]);
    expect(withoutCode('The current 5-minute bucket is still in progress.')).toBe('The current 5-minute period is still in progress.');
    expect(readerSpec({ stats: [], panels: [], callouts: ['The 05:35 bucket burned 9.39 AVAX.'] }, []).callouts).toEqual(['The 05:35 period burned 9.39 AVAX.']);
    expect(withoutCode('Fees burned per 5 minutes. The current 5-minute bucket is still in progress.')).toBe('Fees burned per 5 minutes. The current 5-minute period is still in progress.');
    expect(plainLabel('Fees per bucket')).toBe('Fees per period');
    expect(plainWords('Buckets of 5 minutes')).toBe('Periods of 5 minutes');
  });

  it('writes a shortened address out from the rows, and leaves out a callout naming one the rows do not hold', () => {
    const a = `0xbe05${'1'.repeat(32)}3d8d`;
    expect(withFullHex('The same 300.1k USDT went to 0xbe05…3d8d.', [a])).toBe(`The same 300.1k USDT went to ${a}.`);
    expect(withFullHex('It went to 0xbe05...8d8d.', [a])).toBeNull();
    expect(withFullHex(`It went to ${a}.`, [a])).toBe(`It went to ${a}.`);
    expect(withFullHex(`It went to 0x${'f'.repeat(40)}.`, [a])).toBeNull();
  });

  it('writes out an address shortened to its head alone, as the regression audit\'s R06 named one', () => {
    const a = `0x278d858f${'2'.repeat(28)}9c1e`;
    expect(withFullHex('MEV Bot (SafeProxy arb) (0x278d858f…) used 10.2B gas.', [a])).toBe(`MEV Bot (SafeProxy arb) (${a}) used 10.2B gas.`);
    expect(withFullHex('It went to 0x278d858f....', [a])).toBe(`It went to ${a}.`);
    expect(withFullHex('It went to 0x9999…, twice.', [a])).toBeNull();
    expect(readerSpec({ stats: [], panels: [], callouts: ['0x278d858f… used 10.2B gas.'] }, [], [a]).callouts).toEqual([`${a} used 10.2B gas.`]);
  });

  it('keeps a snake_case name the rows hold, and still flags a column', () => {
    const cols = ['contract', 'method', 'gas_used'];
    const a = `0x30f7${'1'.repeat(36)}`;
    // a name the rows hold as a value, and one the server gave an address (R06's contract)
    const shown = rowWords([{ contract: a, method: 'exchange_underlying', gas_used: 10 }, { contract: null, method: 'swap', gas_used: 9 }], { contract: { [a]: 'POPA_SUBMISSIONS_TIERS' } });
    expect([...shown]).toEqual(['exchange_underlying', 'POPA_SUBMISSIONS_TIERS']);
    expect(codeWords('POPA_SUBMISSIONS_TIERS used 10.2B gas.', cols, shown)).toEqual([]);
    expect(codeWords('POPA_SUBMISSIONS_TIERS has the most gas_used.', cols, shown)).toEqual(['gas_used']);
    expect(codeWords('POPA_SUBMISSIONS_TIERS used 10.2B gas.', cols)).toEqual(['POPA_SUBMISSIONS_TIERS']);
    // a value that is a column's name too is still a column
    expect(codeWords('gas_used rose.', ['metric', 'gas_used'], rowWords([{ metric: 'gas_used' }]))).toEqual(['gas_used']);
    const v: VisualSpec = { stats: [], panels: [], callouts: ['POPA_SUBMISSIONS_TIERS used 10.2B gas.', 'Its gas_used is 10.2B.'] };
    expect(readerSpec(v, cols, [], shown).callouts).toEqual(['POPA_SUBMISSIONS_TIERS used 10.2B gas.']);
    expect(plainLabel('Gas of POPA_SUBMISSIONS_TIERS, seen_7d', shown)).toBe('Gas of POPA_SUBMISSIONS_TIERS, seen 7d');
  });

  it('counts a callout as the page draws it, each full address and hash short', () => {
    expect(shownLength(`Sent by 0x${'a'.repeat(40)} in 0x${'b'.repeat(64)}.`)).toBe('Sent by 0xaaaa…aaaa in 0xbbbb…bbbb.'.length);
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

  it('gives the largest rise and fall between neighbouring rows, in time order', () => {
    const columns = [{ name: 't', type: 'Date' }, { name: 'supply', type: 'Float64' }];
    const rows = [{ t: '2026-09-16', supply: 390 }, { t: '2026-09-15', supply: 400 }, { t: '2026-09-14', supply: 100 }, { t: '2026-08-13', supply: 90 }];
    const f = figures({ columns, rows, names: {}, x: 't' }).join('\n');
    expect(f).toContain('largest rise between neighbouring rows +300 from t 2026-09-14 to t 2026-09-15');
    expect(f).toContain('largest fall between neighbouring rows -10 from t 2026-09-15 to t 2026-09-16');
    const shuffled = [rows[1], rows[3], rows[0], rows[2]];
    expect(figures({ columns, rows: shuffled, names: {}, x: 't' }).join('\n')).not.toContain('between neighbouring rows');
  });

  it('says which edge buckets the window cuts, and that a stale index cuts the last one', () => {
    const columns = [{ name: 't', type: 'Date' }, { name: 'txs', type: 'UInt64' }];
    const rows = [20, 21, 22, 23, 24, 25, 26, 27].map((d) => ({ t: `2026-09-${d}`, txs: d === 20 ? 964435 : 500000 }));
    const sql = 'SELECT toDate(block_time) AS t, count() AS txs FROM raw_txs WHERE block_time >= toStartOfDay(now()) - INTERVAL 7 DAY GROUP BY t ORDER BY t';
    const input = { columns, rows, names: {}, x: 't', sql, anchor: '2026-09-27 06:10:00' };
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      // read ten minutes after the index's last block
      vi.setSystemTime(new Date('2026-09-27T06:20:00Z'));
      expect(figures(input)).toContain('Edges: the first period, t 2026-09-20, is complete; the last, t 2026-09-27, is still filling.');
      // read two months later: the last day fills no more
      vi.setSystemTime(new Date('2026-11-26T06:10:00Z'));
      expect(figures(input)).toContain('Edges: the first period, t 2026-09-20, is complete; the last, t 2026-09-27, is cut where the index ends.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the row that holds a whole-result extreme the rows do not show', () => {
    const columns = [{ name: 'sender', type: 'String' }, { name: 'recipients', type: 'UInt64' }];
    const rows = [{ sender: '0xc5f6', recipients: 1 }, { sender: '0xabd2', recipients: 10 }, { sender: '0x9ecf', recipients: 2 }];
    const t: Totals = { rows: 1406, newest: false, sum: { recipients: 2060 }, count: { recipients: 1406 }, min: { recipients: 0 }, max: { recipients: 16 }, distinct: { sender: 1406 }, label: 'sender', maxAt: { recipients: '0x07b51ade' }, minAt: { recipients: '0x0000' } };
    const f = figures({ columns, rows, names: {}, totals: t }).join('\n');
    expect(f).toContain('max 10 at sender 0xabd2 (16 at sender 0x07b51ade, in a row not shown)');
    expect(f).toContain('min 1 at sender 0xc5f6 (0 at sender 0x0000, in a row not shown)');
  });
});
