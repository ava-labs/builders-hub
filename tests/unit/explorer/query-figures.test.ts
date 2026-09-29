import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));

import { generateText } from 'ai';
import { designVisual, figures, sampleOf } from '@/lib/explorer-query/visual';

// the follow-up audit's T15 (Gunzilla, today against the day before, by hour of the UTC day): today has reached hour 7
const TODAY = [19281, 21066, 14059, 8912, 7319, 16842, 15013, 8614];
const YESTERDAY = [19687, 14761, 11371, 9445, 9788, 17494, 13443, 9755, 7209, 8505, 9672, 9259];
const hours = YESTERDAY.map((y, h) => ({ hour_offset: h, today_txs: TODAY[h] ?? 0, yesterday_txs: y }));
const hourColumns = [{ name: 'hour_offset', type: 'UInt8' }, { name: 'today_txs', type: 'UInt64' }, { name: 'yesterday_txs', type: 'UInt64' }];

describe('Figures on a period beside the one before it', () => {
  it('compares the two over the rows the current period has reached', () => {
    const f = figures({ columns: hourColumns, rows: hours, names: {}, x: 'hour_offset' });
    // yesterday's first 8 hours hold 105,744: the reading had said 112.7k, and so called a lead a lag
    expect(f.find((l) => l.startsWith('Matched rows'))).toContain('Matched rows: today_txs has values up to hour_offset 7, so it compares with yesterday_txs over the 8 rows up to there, total 111106 against 105744: today_txs is +5.1% against yesterday_txs.');
  });

  it('leaves out the last row of a current period that runs to now, which is still filling', () => {
    // the regression audit's R01: today's hour 8 held 34 minutes, set against yesterday's whole hour 8
    const sql = 'SELECT toHour(block_time) AS hour_offset, countIf(block_time >= toStartOfDay(now())) AS today_txs, countIf(block_time < toStartOfDay(now())) AS yesterday_txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfDay(now()) - INTERVAL 1 DAY GROUP BY hour_offset ORDER BY hour_offset';
    const line = figures({ columns: hourColumns, rows: hours, names: {}, x: 'hour_offset', sql }).find((l) => l.startsWith('Matched rows'))!;
    // hours 0 to 6: today 102,492 against yesterday 95,989
    expect(line).toContain('Matched rows: today_txs has values up to hour_offset 7, so it compares with yesterday_txs over the 7 complete rows before it, total 102492 against 95989: today_txs is +6.8% against yesterday_txs. hour_offset 7 is still filling, so it is left out');
    // a period that has reached one row only, which is still filling, is never compared
    const first = hours.map((r, h) => ({ ...r, today_txs: h === 0 ? 50 : 0 }));
    expect(figures({ columns: hourColumns, rows: first, names: {}, x: 'hour_offset', sql }).find((l) => l.startsWith('Matched rows'))).toBe("Matched rows: today_txs has a value only at hour_offset 0, which is still filling: never set it against yesterday_txs's whole period.");
  });

  it('gives no such line when the current period has reached every row', () => {
    const full = hours.map((r) => ({ ...r, today_txs: r.yesterday_txs + 1 }));
    expect(figures({ columns: hourColumns, rows: full, names: {}, x: 'hour_offset' }).join('\n')).not.toContain('Matched rows');
  });

  it('pairs current_ with previous_ and a suffix period too', () => {
    const rows = [1, 2, 3, 4].map((d) => ({ day: d, txs_this_week: d < 3 ? 10 * d : null, txs_last_week: 5 * d }));
    const columns = [{ name: 'day', type: 'UInt8' }, { name: 'txs_this_week', type: 'Nullable(UInt64)' }, { name: 'txs_last_week', type: 'UInt64' }];
    expect(figures({ columns, rows, names: {}, x: 'day' })).toContain('Matched rows: txs_this_week has values up to day 2, so it compares with txs_last_week over the 2 rows up to there, total 30 against 15: txs_this_week is +100.0% against txs_last_week. Compare the two periods over these rows, never one period\'s part with the other\'s whole.');
  });
});

describe('Figures on an average or a maximum in each row', () => {
  // the follow-up audit's T10: hourly average gas prices, with the transactions of each hour
  const rows = [
    { offset_hour: 0, current_avg_gwei: 30, previous_avg_gwei: 20, current_txs: 100, previous_txs: 300 },
    { offset_hour: 1, current_avg_gwei: 40, previous_avg_gwei: 30, current_txs: 300, previous_txs: 100 },
    { offset_hour: 2, current_avg_gwei: null, previous_avg_gwei: 25, current_txs: 0, previous_txs: 200 },
  ];
  const columns = [{ name: 'offset_hour', type: 'UInt8' }, { name: 'current_avg_gwei', type: 'Nullable(Float64)' }, { name: 'previous_avg_gwei', type: 'Float64' }, { name: 'current_txs', type: 'UInt64' }, { name: 'previous_txs', type: 'UInt64' }];

  it('gives an average no total, and the average over what the rows count', () => {
    const f = figures({ columns, rows, names: {}, x: 'offset_hour' });
    const line = f.find((l) => l.startsWith('current_avg_gwei'))!;
    expect(line).toContain('no total: each row holds an average');
    // (30 x 100 + 40 x 300) / 400, where the mean of the two hours is 35
    expect(line).toContain('mean of the row values 35, which is not the average over what the rows count; weighted by current_txs, that average is 37.5');
    expect(f).toContain('Matched rows: current_avg_gwei has values up to offset_hour 1, so it compares with previous_avg_gwei over the 2 rows up to there, average weighted by the counts beside them 37.5 against 22.5: current_avg_gwei is +66.7% against previous_avg_gwei. Compare the two periods over these rows, never one period\'s part with the other\'s whole.');
  });

  it('weighs an average only when one count of its period is beside it', () => {
    const both = rows.map((r) => ({ ...r, current_blocks: 7, previous_blocks: 7 }));
    const cols = [...columns, { name: 'current_blocks', type: 'UInt64' }, { name: 'previous_blocks', type: 'UInt64' }];
    const line = figures({ columns: cols, rows: both, names: {}, x: 'offset_hour' }).find((l) => l.startsWith('current_avg_gwei'))!;
    expect(line).toContain('mean of the row values 35, which is not the average over what the rows count,');
    expect(line).not.toContain('weighted by');
  });

  it("reads a maximum's next rows as their own maxima, with no total or share", () => {
    // the follow-up audit's T02 called the second-highest hourly maximum the second-highest block
    const hourly = [5, 48, 158, 32].map((m, i) => ({ t: `2026-09-2${i + 1} 00:00:00`, max_base_fee_gwei: m }));
    const line = figures({ columns: [{ name: 't', type: "DateTime('UTC')" }, { name: 'max_base_fee_gwei', type: 'Float64' }], rows: hourly, names: {}, x: 't' }).find((l) => l.startsWith('max_base_fee_gwei'))!;
    expect(line).toContain("no total: each row holds its own highest or lowest value");
    expect(line).toContain("max 158 at t 2026-09-23 00:00:00, then the next rows' own maxima (each the highest within its row, not the next highest overall), 48 at");
    expect(line).not.toContain('share of the total');
  });

  it('is refused as a summed stat', async () => {
    type DesignCall = { tools: { design: { execute: (input: unknown) => Promise<unknown> } } };
    const panel = { title: 'Gas price', kind: 'line', x: 'offset_hour', series: [{ column: 'current_avg_gwei', label: 'Today', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc', referenceLines: [], width: 'full' };
    const stat = (agg: string) => ({ label: 'Gas price', column: 'current_avg_gwei', agg, format: 'number', sub: 'today' });
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      results.push(await opts.tools.design.execute({ stats: [stat('sum')], panels: [panel], callouts: [] }));
      results.push(await opts.tools.design.execute({ stats: [stat('avg')], panels: [panel], callouts: [] }));
      return {};
    }) as unknown as typeof generateText);
    await designVisual({ question: 'Compare it with the day before', title: 'Gas price today vs yesterday', note: '', symbol: 'AVAX', columns, rows, names: {}, chart: { kind: 'line', x: 'offset_hour', series: [{ column: 'current_avg_gwei', label: 'Today' }] } });
    expect(results[0]).toMatchObject({ error: expect.stringContaining('current_avg_gwei holds an average or an extreme in each row') });
    expect(results[1]).toEqual({ ok: true });
  });
});

describe('an average over a series with a partial period', () => {
  it('is refused as a stat of a count, while a total passes', async () => {
    // the regression audit's R16: "1,694 a day" with today's 8.8 hours in it, where the 14 whole days average 1,745.8
    type DesignCall = { tools: { design: { execute: (input: unknown) => Promise<unknown> } } };
    const day = (k: number) => new Date(Date.now() - k * 86_400_000).toISOString().slice(0, 10);
    const rows = Array.from({ length: 15 }, (_, i) => ({ t: day(14 - i), delegations: i === 14 ? 964 : 1745 }));
    const columns = [{ name: 't', type: 'Date' }, { name: 'delegations', type: 'UInt64' }];
    const sql = 'SELECT toDate(block_time) AS t, count() AS delegations FROM decoded_p_txs WHERE chain_id = 1 AND block_time >= toDate(now()) - INTERVAL 14 DAY GROUP BY t ORDER BY t';
    const panel = { title: 'Delegations', kind: 'bar', x: 't', series: [{ column: 'delegations', label: 'Delegations', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc', referenceLines: [], width: 'full' };
    const stat = (agg: string) => ({ label: 'Delegations', column: 'delegations', agg, format: 'number', sub: 'per day' });
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      results.push(await opts.tools.design.execute({ stats: [stat('avg')], panels: [panel], callouts: [] }));
      results.push(await opts.tools.design.execute({ stats: [stat('sum')], panels: [panel], callouts: [] }));
      return {};
    }) as unknown as typeof generateText);
    await designVisual({ question: 'How many delegations were made per day over the last 14 days?', title: 'Delegations per day', note: '', symbol: 'AVAX', columns, rows, names: {}, sql, chart: { kind: 'bar', x: 't', series: [{ column: 'delegations', label: 'Delegations' }] } });
    expect(results[0]).toMatchObject({ error: expect.stringContaining('the last period of these rows is partial') });
    expect(results[1]).toEqual({ ok: true });
  });
});

describe('the rows a reading sees of a long answer', () => {
  it('hold the rows either side of each highest', () => {
    // the follow-up audit's T02: 169 hourly rows, and a reading named the hour after the peak from a row it never saw
    const rows = Array.from({ length: 169 }, (_, i) => ({ t: `h${String(i).padStart(3, '0')}`, fee: i === 70 ? 158 : i === 150 ? 0.01 : 1 + (i % 3) }));
    const s = sampleOf({ columns: [{ name: 't', type: 'String' }, { name: 'fee', type: 'Float64' }], rows, names: {}, x: 't' });
    expect(s.rows.map((r) => r.t)).toEqual(expect.arrayContaining(['h069', 'h070', 'h071']));
    expect(s.head).toContain('the rows either side of each highest');
  });
});

beforeEach(() => vi.mocked(generateText).mockReset());
