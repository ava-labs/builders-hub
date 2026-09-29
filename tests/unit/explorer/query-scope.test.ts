import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());
const getRecipe = vi.hoisted(() => vi.fn());
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery,
  anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })),
  schemaCard: vi.fn(async () => ''),
  coverage: vi.fn(async () => null),
  coverageText: vi.fn(() => ''),
}));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe, putRecipe: vi.fn(async () => {}), recipeKey: vi.fn(() => 'key') }));
vi.mock('@/lib/explorer-query/prompt', () => ({ dexQuestion: vi.fn(() => false), pchainPrompt: vi.fn(() => 'system'), systemPrompt: vi.fn(() => 'system'), userTurn: vi.fn((_c: number, p: string) => p) }));
vi.mock('@/lib/explorer-query/guard', () => ({ MAX_ROWS: 5000, guardSql: vi.fn((sql: string) => ({ ok: true, sql })), literalWindow: vi.fn(() => null), negativeFigure: vi.fn(() => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/examples', () => ({ PCHAIN_EXAMPLES: [], examplesFor: vi.fn(() => []) }));

import { generateText } from 'ai';
import { answerQuestion, type QueryEvent } from '@/lib/explorer-query/answer';
import { guardSql } from '@/lib/explorer-query/guard';
import { collapseMacros, expandMacros } from '@/lib/explorer-query/macros';
import { rowsWindow, scopeError, scoped, sqlWindow, windowWords, type Window } from '@/lib/explorer-query/scope';

// Monday September 28, 2026, an hour into the week
const NOW = Date.parse('2026-09-28T01:00:00Z');
const at = (s: string) => Date.parse(`${s}Z`);
const LOGS = 'FROM raw_logs WHERE chain_id = 43114';
const WEEK_OF_21 = `${LOGS} AND block_time >= toDateTime('2026-09-21 00:00:00') AND block_time < toDateTime('2026-09-28 00:00:00')`;
const win = (sql: string) => sqlWindow(sql, NOW) as Window;

describe('the window a query reads', () => {
  it('is the DEX window, not the pools read since the first day or the price read from the hour before', () => {
    const dex = `WITH pools AS (SELECT l.address AS pool FROM raw_logs AS l WHERE l.chain_id = 43114 AND l.block_time >= '2020-09-23' AND l.topic0 = x), swap_logs AS (SELECT address AS pool ${WEEK_OF_21} AND topic0 IN (a, b)), px AS (SELECT toStartOfHour(block_time) AS hour ${LOGS} AND block_time >= toDateTime('2026-09-21 00:00:00') - INTERVAL 1 HOUR AND topic0 = a GROUP BY hour) SELECT pool FROM swap_logs`;
    expect(sqlWindow(dex, NOW)).toEqual({ start: at('2026-09-21T00:00:00'), end: at('2026-09-28T00:00:00'), open: false, rolling: false });
  });

  it("is a shorthand's own start and end, not the WITH it stands for, which reads further back", () => {
    expect(win('$LIQUIDATIONS(toMonday(now())) SELECT protocol, count() AS n FROM liquidations GROUP BY protocol')).toEqual({ start: at('2026-09-28T00:00:00'), end: NOW, open: true, rolling: false });
    expect(win("$LEND(now() - INTERVAL 24 HOUR, 'aave-v3') SELECT count() AS n FROM actions")).toMatchObject({ start: NOW - 86_400_000, open: true, rolling: true });
    expect(win("$DEX(toDateTime('2026-09-21 00:00:00'), toDateTime('2026-09-28 00:00:00'), 'pharaoh') SELECT sum(usd) AS v FROM legs")).toEqual({ start: at('2026-09-21T00:00:00'), end: at('2026-09-28T00:00:00'), open: false, rolling: false });
    expect(win('$PRICES(toStartOfDay(now())), fl AS (SELECT 1 AS x) SELECT x FROM fl')).toMatchObject({ start: at('2026-09-28T00:00:00'), open: true });
    // a shorthand with no window: the query's own bounds, or none
    expect(sqlWindow("$DEBTS('aave-v3') SELECT count() AS n FROM debts", NOW)).toBeNull();
    expect(win(`$POOLS() SELECT pool ${LOGS} AND block_time >= toMonday(now())`)).toMatchObject({ start: at('2026-09-28T00:00:00'), open: true });
    // the lending WITHs the guard writes out read as their shorthand once it is written back
    for (const short of ['$LIQUIDATIONS(toMonday(now())) SELECT protocol, count() AS n FROM liquidations GROUP BY protocol', "$LEND(toMonday(now()), 'benqi') SELECT action, count() AS n FROM actions GROUP BY action", '$PRICES(toMonday(now())) SELECT count() AS n FROM prices']) {
      const x = expandMacros(short, 43114);
      if (!x.ok) throw new Error(x.error);
      expect(collapseMacros(x.sql, 43114)).toBe(short);
      expect(win(collapseMacros(x.sql, 43114)), short).toMatchObject({ start: at('2026-09-28T00:00:00'), open: true });
    }
  });

  it('reads calendar and rolling windows that run to now', () => {
    expect(win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now())`)).toMatchObject({ start: at('2026-09-28T00:00:00'), open: true, rolling: false });
    expect(win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 7 DAY`)).toMatchObject({ start: NOW - 7 * 86_400_000, open: true, rolling: true });
    expect(win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 11 WEEK`).start).toBe(at('2026-07-13T00:00:00'));
    expect(win(`SELECT 1 ${LOGS} AND block_time >= toMonday(toDateTime('2026-09-27'))`).start).toBe(at('2026-09-21T00:00:00'));
    // an end that only keeps clear of the newest rows is no end
    expect(win(`SELECT 1 FROM p_validator_snapshots WHERE chain_id = 1 AND snapshot_time >= toDate(now()) - INTERVAL 30 DAY AND snapshot_time <= now() - INTERVAL 15 MINUTE`)).toMatchObject({ start: at('2026-08-29T00:00:00'), open: true });
  });

  it('is not known when a bound is one it cannot read, or when the query reads two periods', () => {
    expect(sqlWindow(`SELECT 1 ${LOGS} AND block_time >= (SELECT max(block_time) FROM raw_blocks WHERE chain_id = 43114) - INTERVAL 1 HOUR`, NOW)).toBe('unknown');
    expect(sqlWindow(`SELECT countIf(block_time >= toMonday(now())) AS this_week, countIf(block_time >= toMonday(now()) - INTERVAL 7 DAY AND block_time < toMonday(now())) AS last_week ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 7 DAY`, NOW)).toBe('unknown');
    expect(sqlWindow(`SELECT count() FROM p_validator_versions WHERE chain_id = 1`, NOW)).toBeNull();
  });

  it('is the rows\' own span when the query bounds none, as sharp as their bucket', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ t: new Date(at('2026-07-13T00:00:00') + i * 7 * 86_400_000).toISOString().slice(0, 10), swaps: i }));
    expect(rowsWindow(rows, 't', NOW)).toEqual({ start: at('2026-07-13T00:00:00'), end: NOW, open: true, grain: 7 * 86_400_000 });
    expect(rowsWindow(rows, 'swaps', NOW)).toBeNull();
  });

  it('is said in a title\'s words', () => {
    expect(windowWords(win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 24 HOUR`), NOW)).toBe('in the last 24 hours');
    expect(windowWords(win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 30 DAY`), NOW)).toBe('in the last 30 days');
    expect(windowWords(win(`SELECT 1 ${LOGS} AND block_time >= toStartOfDay(now())`), NOW)).toBe('today');
    expect(windowWords(win(`SELECT 1 ${WEEK_OF_21}`), NOW)).toBe('in the week of September 21');
    expect(windowWords(win(`SELECT 1 ${LOGS} AND block_time >= '2026-09-26' AND block_time < '2026-09-27'`), NOW)).toBe('on September 26');
    expect(windowWords(win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 7 DAY`), NOW)).toBe('since September 21');
  });
});

describe('a title and a note name the window the query reads', () => {
  it('turns back "this week" over the week of September 21, and says it in the window\'s words', () => {
    const w = win(`SELECT 1 ${WEEK_OF_21}`);
    const title = 'Top Uniswap v3 pools by volume this week';
    expect(scopeError(title, '', w, NOW)).toBe('the title says "this week", but the query reads 2026-09-21 00:00 to 2026-09-28 00:00 UTC (in the week of September 21). Name the window the query reads, or fix the query if the question asks for another window, and call render_chart again.');
    expect(scoped({ title, note: 'Volume counts the stablecoin leg.' }, w, NOW)).toEqual({ title: 'Top Uniswap v3 pools by volume in the week of September 21', note: 'Volume counts the stablecoin leg.' });
  });

  it('turns back a note that starts a twelve-week chart on Monday of this week, and leaves that sentence out', () => {
    const w = win(`SELECT toMonday(block_time) AS t, count() AS swaps ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 11 WEEK GROUP BY t`);
    const note = 'Swaps per calendar week. The chart starts on Monday of this week.';
    expect(scopeError('Swaps per week', note, w, NOW)).toContain('the note says "chart starts on Monday of this week"');
    expect(scoped({ title: 'Swaps per week', note }, w, NOW).note).toBe('Swaps per calendar week.');
    // the rows alone tell the same when the query has no bound to read
    const rows = Array.from({ length: 12 }, (_, i) => ({ t: new Date(at('2026-07-13T00:00:00') + i * 7 * 86_400_000).toISOString().slice(0, 10) }));
    expect(scopeError('Swaps per week', note, rowsWindow(rows, 't', NOW)!, NOW)).toContain('chart starts on Monday of this week');
  });

  it('turns back a calendar week that starts a week early, and a day the query reads in another year', () => {
    // an hour into Monday, the week before this one reads as the last seven days, so only the title is wrong
    expect(scopeError('Top pools this week', 'This week is the rolling seven-day window.', win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 7 DAY`), NOW)).toMatch(/^the title says "this week", but the query reads 2026-09-21 00:00 UTC to now \(since September 21\)/);
    expect(scoped({ title: 'Uniswap volume by version on September 26', note: '' }, win(`SELECT 1 ${LOGS} AND block_time >= '2024-09-26' AND block_time < '2024-09-27'`), NOW).title).toBe('Uniswap volume by version on September 26, 2024');
  });

  it('passes the words that fit: the window itself, a bucket inside it, each week\'s own start, and a comparison', () => {
    const twelve = win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 11 WEEK`);
    expect(scopeError('Swaps this week', 'Since Monday.', win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now())`), NOW)).toBeNull();
    expect(scopeError('Swaps in the last 7 days', '', win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 7 DAY`), NOW)).toBeNull();
    expect(scopeError('Swaps in the last 7 days', '', win(`SELECT 1 ${LOGS} AND block_time >= toStartOfDay(now()) - INTERVAL 7 DAY`), NOW)).toBeNull();
    expect(scopeError('Swaps per week', 'The last bar is this week, still filling. Each row is one calendar week starting Monday.', twelve, NOW)).toBeNull();
    expect(scopeError('Swaps per day', 'The last day may be incomplete.', win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 7 DAY`), NOW)).toBeNull();
    expect(scopeError('Swaps this week vs last week', '', twelve, NOW)).toBeNull();
  });

  it('turns back a date the window does not start at, as a note wrote "Since Monday 2026-09-21" over this week', () => {
    const w = win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now())`);
    const note = 'Net flow is supplies less withdrawals. Since Monday 2026-09-21.';
    expect(scopeError('Net flow per asset this week', note, w, NOW)).toContain('the note says "Since Monday 2026-09-21"');
    expect(scoped({ title: 'Net flow per asset this week', note }, w, NOW).note).toBe('Net flow is supplies less withdrawals.');
    // the date the window starts at passes, and so does a day inside the window
    expect(scopeError('Net flow per asset this week', 'Since Monday 2026-09-28.', w, NOW)).toBeNull();
    expect(scopeError('Swaps per day', 'The busiest day was 2026-08-03.', win(`SELECT 1 ${LOGS} AND block_time >= toMonday(now()) - INTERVAL 11 WEEK`), NOW)).toBeNull();
    // a title's own date names its day
    expect(scopeError('Swaps, September 21', '', w, NOW)).toContain('the title says "September 21"');
  });

  it('opens with a capital, but keeps a name that has capitals of its own', () => {
    // family replays titled "SAVAX staked and redeemed per day" and "SavUSD share price per day this month"
    const w = win(`SELECT 1 ${LOGS} AND block_time >= toStartOfMonth(now())`);
    expect(scoped({ title: 'savUSD share price per day this month', note: '' }, w, NOW).title).toMatch(/^savUSD share price per day/);
    expect(scoped({ title: 'sAVAX staked and redeemed per day', note: '' }, w, NOW).title).toMatch(/^sAVAX staked/);
    expect(scoped({ title: 'swaps per day', note: '' }, w, NOW).title).toMatch(/^Swaps per day/);
  });

  it('moves a possessive scope to the end, and keeps one preposition', () => {
    const day = win(`SELECT 1 ${LOGS} AND block_time >= now() - INTERVAL 24 HOUR`);
    expect(scoped({ title: "Today's busiest contracts", note: '' }, day, NOW).title).toBe('Busiest contracts in the last 24 hours');
    expect(scoped({ title: 'Swaps for this week', note: '' }, win(`SELECT 1 ${WEEK_OF_21}`), NOW).title).toBe('Swaps in the week of September 21');
  });
});

// a writer that hands render_chart the same answer on every step
type Call = { tools: { render_chart: { execute: (input: unknown, o: unknown) => Promise<unknown> } }; stopWhen: ((o: { steps: unknown[] }) => boolean | PromiseLike<boolean>)[]; onStepFinish: (s: unknown) => void };
const results: unknown[] = [];
const writes = (final: object) =>
  (async (opts: Call) => {
    const steps: unknown[] = [];
    do {
      results.push(await opts.tools.render_chart.execute(final, {}));
      steps.push({});
      opts.onStepFinish({});
    } while (!(await Promise.all(opts.stopWhen.map((s) => s({ steps })))).some(Boolean));
    return { totalUsage: { inputTokens: 0, inputTokenDetails: { cacheReadTokens: 0 } } };
  }) as unknown as typeof generateText;
const ROWS = { columns: [{ name: 'pool', type: 'String' }, { name: 'volume_usd', type: 'Float64' }], rows: [{ pool: '0xab', volume_usd: 5 }], rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false };
const FINAL = { title: 'Top pools by volume this week', note: 'Volume in USD. Since Monday.', sql: `SELECT pool, volume_usd ${WEEK_OF_21}`, chart: { kind: 'bar', x: 'pool', series: [{ column: 'volume_usd', label: 'Volume' }] } };
const ask = async (chainId: number) => {
  const events: QueryEvent[] = [];
  const answer = await answerQuestion({ chainId, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Top pools by volume in the week of Monday September 21', history: [], baseUrl: 'http://localhost:3000', emit: (e) => events.push(e) });
  return { answer, events };
};

describe('the writer names the window its query reads', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue(ROWS);
    getRecipe.mockReset().mockResolvedValue(null);
    results.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('is told once, before the query runs, and what it still gets wrong gives way to the window\'s words', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const { answer } = await ask(43114);
    expect(results[0]).toEqual({ error: expect.stringContaining('the title says "this week"') });
    expect(results).toHaveLength(2);
    // the turned-back answer ran no query
    expect(runQuery).toHaveBeenCalledOnce();
    expect(answer).toMatchObject({ title: 'Top pools by volume in the week of September 21', note: 'Volume in USD.' });
  });

  it("turns back a lending note's wrong date, read off its shorthand under the WITH the guard writes out", async () => {
    vi.mocked(guardSql).mockImplementation((sql: string) => {
      const x = expandMacros(sql, 43114);
      return x.ok ? { ok: true, sql: x.sql, tables: [] } : { ok: false, error: x.error };
    });
    runQuery.mockResolvedValue({ ...ROWS, columns: [{ name: 'protocol', type: 'String' }, { name: 'liquidations', type: 'UInt64' }], rows: [{ protocol: 'aave-v3', liquidations: 3 }, { protocol: 'benqi', liquidations: 1 }], rowCount: 2 });
    const l04 = { title: 'Liquidations per protocol this week', note: 'Liquidations on Aave and Benqi. Since Monday 2026-09-23.', sql: '$LIQUIDATIONS(toMonday(now())) SELECT protocol, count() AS liquidations FROM liquidations GROUP BY protocol', chart: { kind: 'bar', x: 'protocol', series: [{ column: 'liquidations', label: 'Liquidations' }] } };
    vi.mocked(generateText).mockImplementation(writes(l04));
    try {
      const answer = await answerQuestion({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Liquidations per protocol this week', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });
      expect(results[0]).toEqual({ error: expect.stringContaining('the note says "Since Monday 2026-09-23", but the query reads 2026-09-28 00:00 UTC to now') });
      expect(answer).toMatchObject({ title: 'Liquidations per protocol this week', note: 'Liquidations on Aave and Benqi.' });
    } finally {
      vi.mocked(guardSql).mockReset();
    }
  });

  it("names a kept lending answer's window off its shorthand too", async () => {
    const x = expandMacros('$LIQUIDATIONS(toMonday(now())) SELECT protocol, count() AS liquidations FROM liquidations GROUP BY protocol', 43114);
    if (!x.ok) throw new Error(x.error);
    runQuery.mockResolvedValue({ ...ROWS, columns: [{ name: 'protocol', type: 'String' }, { name: 'liquidations', type: 'UInt64' }], rows: [{ protocol: 'aave-v3', liquidations: 3 }, { protocol: 'benqi', liquidations: 1 }], rowCount: 2 });
    getRecipe.mockResolvedValue({ question: 'q', title: 'Liquidations per protocol this week', note: 'Liquidations on Aave and Benqi. Since Monday 2026-09-23.', sql: x.sql, chart: { kind: 'bar', x: 'protocol', series: [{ column: 'liquidations', label: 'Liquidations' }] }, drill: null, visual: null, writer: 'Haiku 4.5', at: 0 });
    const { answer } = await ask(43114);
    expect(answer).toMatchObject({ title: 'Liquidations per protocol this week', note: 'Liquidations on Aave and Benqi.', model: { cached: true } });
  });

  it('names it in a kept answer too', async () => {
    getRecipe.mockResolvedValue({ question: 'q', title: FINAL.title, note: FINAL.note, sql: FINAL.sql, chart: FINAL.chart, drill: null, visual: null, writer: 'Haiku 4.5', at: 0 });
    const { answer } = await ask(43114);
    expect(answer).toMatchObject({ title: 'Top pools by volume in the week of September 21', note: 'Volume in USD.', model: { cached: true } });
  });

  it('leaves Fuji\'s words as they were', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const { answer } = await ask(43113);
    expect(results).toHaveLength(1);
    expect(answer).toMatchObject({ title: FINAL.title, note: FINAL.note });
  });
});
