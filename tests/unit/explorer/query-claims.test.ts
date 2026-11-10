import { beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery,
  anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })),
  schemaCard: vi.fn(async () => ''),
  coverage: vi.fn(async () => null),
  coverageText: vi.fn(() => ''),
}));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putRecipe: vi.fn(async () => {}), recipeKey: vi.fn(() => 'key') }));
vi.mock('@/lib/explorer-query/prompt', () => ({ dexQuestion: vi.fn(() => false), pchainPrompt: vi.fn(() => 'system'), systemPrompt: vi.fn(() => 'system'), userTurn: vi.fn((_c: number, p: string) => p) }));
vi.mock('@/lib/explorer-query/guard', () => ({ MAX_ROWS: 5000, guardSql: vi.fn((sql: string) => ({ ok: true, sql })), literalWindow: vi.fn(() => null), negativeFigure: vi.fn(() => null) }));
vi.mock('@/lib/explorer-query/checks', () => ({ protocolScope: vi.fn(() => null), unitName: vi.fn(() => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/examples', () => ({ PCHAIN_EXAMPLES: [], examplesFor: vi.fn(() => []) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { contradictions, withoutContradictions } from '@/lib/explorer-query/claims';
import { cutOf } from '@/lib/explorer-query/cut';

const one = (name: string, type: string, v: number) => ({ columns: [{ name, type }], rows: [{ [name]: v }], rowCount: 1 });

describe('a note held against its rows', () => {
  it('says none of what the one row holds, as an L09 note said no flash loans over $796.85', () => {
    const rows = one('volume_usd', 'Float64', 796.85);
    const note = 'Flash loans on Aave, valued at each hour\'s price. No flash loan events were recorded on Aave this week.';
    expect(contradictions(note, 'Aave flash loans this week', rows)).toEqual([{ sentence: 'No flash loan events were recorded on Aave this week.', error: 'the note says "No flash loan events were recorded on Aave this week.", but the rows hold volume_usd 796.85.' }]);
    expect(withoutContradictions(note, 'Aave flash loans this week', rows)).toBe('Flash loans on Aave, valued at each hour\'s price.');
  });

  it('gives a figure over rows that are all zero, the reverse', () => {
    expect(contradictions('12 flash loans were borrowed this week.', 'Aave flash loans this week', one('flash_loans', 'UInt64', 0))[0].error).toBe('the note gives 12 ("12 flash loans were borrowed this week."), but every figure in the rows is 0.');
    expect(contradictions('Flash loans came to $796.85.', 'Aave flash loans', { columns: [{ name: 'volume_usd', type: 'Float64' }], rows: [], rowCount: 0 })[0].error).toContain('but the query returned no rows');
  });

  it('passes a none that fits the rows, one said of part of them, and a none of something else', () => {
    expect(contradictions('No flash loans were borrowed on Aave this week.', 'Aave flash loans this week', one('flash_loans', 'UInt64', 0))).toEqual([]);
    expect(contradictions('No liquidations were over $1M.', 'Liquidations this week', one('liquidations', 'UInt64', 4))).toEqual([]);
    expect(contradictions('Unpriced assets have no USD price. No priced leg is counted twice. The fee is 0.05% on Uniswap v3, over 24 hours.', 'Uniswap v3 fees today', one('fees_usd', 'Float64', 12))).toEqual([]);
    // over many rows, a none of one protocol holds while another protocol's row is not zero
    const many = { columns: [{ name: 'protocol', type: 'String' }, { name: 'liquidations', type: 'UInt64' }], rows: [{ protocol: 'aave-v3', liquidations: 42 }, { protocol: 'benqi', liquidations: 0 }], rowCount: 2 };
    expect(contradictions('No liquidations happened on Benqi.', 'Liquidations per protocol', many)).toEqual([]);
    expect(contradictions('No liquidations happened on Benqi.', 'Liquidations per protocol', { ...many, rows: [many.rows[0], { protocol: 'benqi', liquidations: 3 }] })[0].error).toBe('the note says "No liquidations happened on Benqi.", but the rows hold liquidations 45 over 2 rows.');
  });
});

// L02: a test counted 48,336 borrowers and the final rows 48,292; the note kept the test's total
const L02_NOTE = 'The 15 largest borrowers on Aave by debt, of 48,336 total borrowers on the protocol now.';
const l02 = (ofTotal: number) => ({
  columns: [{ name: 'borrower_address', type: 'String' }, { name: 'debt_usd', type: 'Float64' }, { name: 'debts', type: 'UInt64' }, { name: 'share_pct', type: 'Float64' }, { name: 'of_total', type: 'UInt64' }],
  rows: Array.from({ length: 15 }, (_, i) => ({ borrower_address: `0x${String(i).padStart(40, '0')}`, debt_usd: 52826683.82 / (i + 1), debts: 1 + (i % 3), share_pct: 29.4 / (i + 1), of_total: ofTotal })),
  rowCount: 15,
});

describe('a count or a total the note gives, held against the column that holds it', () => {
  it('sends back the total an earlier test returned, with the rows\' figure written the note\'s way', () => {
    expect(contradictions(L02_NOTE, 'Largest Aave borrowers now', l02(48292))).toEqual([{
      sentence: L02_NOTE,
      error: 'the note gives 48,336 ("The 15 largest borrowers on Aave by debt, of 48,336 total borrowers on the protocol now."), but the rows\' of_total is 48,292.',
      fix: 'The 15 largest borrowers on Aave by debt, of 48,292 total borrowers on the protocol now.',
    }]);
    expect(withoutContradictions(`${L02_NOTE} Debt is valued at today's prices.`, 'Largest Aave borrowers now', l02(48292))).toBe('The 15 largest borrowers on Aave by debt, of 48,292 total borrowers on the protocol now. Debt is valued at today\'s prices.');
    expect(contradictions('The 15 largest borrowers, out of 48,336.', 'Largest Aave borrowers now', l02(48292))[0].fix).toBe('The 15 largest borrowers, out of 48,292.');
  });

  it('passes a total within its rounding, a bound, the rows\' own count, and a total of another kind', () => {
    for (const note of [
      'The 15 largest borrowers, of 48,292 total borrowers.',
      'The 15 largest borrowers, of 48.3k total borrowers.',
      'The 15 largest borrowers, of 48,000 borrowers in all.',
      'The 15 largest borrowers, of about 48,500 borrowers.',
      'The 15 largest borrowers, of over 40,000 borrowers.',
      'The top 15 borrowers hold 58% of the debt.',
      'The 15 largest borrowers, of 48,336 total swaps.',
    ]) expect(contradictions(note, 'Largest Aave borrowers now', l02(48292))).toEqual([]);
    // no column holds the total: the figure is left alone
    const noTotal = { ...l02(48292), columns: l02(48292).columns.slice(0, 4) };
    expect(contradictions(L02_NOTE, 'Largest Aave borrowers now', noTotal)).toEqual([]);
  });

  it('holds a one-row answer\'s counts and dollars by the names of its columns, unless a clause qualifies them', () => {
    const today = { columns: [{ name: 'swaps', type: 'UInt64' }, { name: 'traders', type: 'UInt64' }, { name: 'total_volume_usd', type: 'Float64' }], rows: [{ swaps: 1250, traders: 312, total_volume_usd: 1.79e9 }], rowCount: 1 };
    const [c] = contradictions('There were 1,234 swaps today by 312 traders.', 'Uniswap swaps today', today);
    expect(c.error).toBe('the note gives 1,234 ("There were 1,234 swaps today by 312 traders."), but the rows\' swaps is 1,250.');
    expect(c.fix).toBe('There were 1,250 swaps today by 312 traders.');
    // a figure that names nothing it counts is left alone
    expect(contradictions('Swaps came to 1.1k today.', 'Uniswap swaps today', today)).toEqual([]);
    expect(contradictions('Volume came to $2.1B in total volume.', 'Uniswap swaps today', today)[0].fix).toBe('Volume came to $1.8B in total volume.');
    expect(contradictions('There were 1.2k swaps and $1.8B of total volume today.', 'Uniswap swaps today', today)).toEqual([]);
    expect(contradictions('1,234 swaps were over $10k.', 'Uniswap swaps today', today)).toEqual([]);
  });
});

// D16: a test step counted 4,978 swaps, and the final rows hold 4,981
const D16_NOTE = 'Fees earned by liquidity providers in the Uniswap v3 WAVAX/USDC 0.05% pool this week (since Monday). The pool had 4,978 swaps with $2.42M in volume.';
const d16 = { columns: [{ name: 'fees_usd', type: 'Float64' }, { name: 'swaps', type: 'UInt64' }, { name: 'priced_swaps', type: 'UInt64' }, { name: 'volume_usd', type: 'Float64' }], rows: [{ fees_usd: 1212.82, swaps: 4981, priced_swaps: 4981, volume_usd: 2425642.22 }], rowCount: 1 };
const perProtocol = (truncated = false) => ({
  columns: [{ name: 'protocol', type: 'String' }, { name: 'swaps', type: 'UInt64' }, { name: 'volume_usd', type: 'Float64' }, { name: 'share_pct', type: 'Float64' }],
  rows: [{ protocol: 'uniswap', swaps: 3000, volume_usd: 1.5e6, share_pct: 60.2 }, { protocol: 'pharaoh', swaps: 1500, volume_usd: 7.2e5, share_pct: 30.1 }, { protocol: 'blackhole-dex', swaps: 481, volume_usd: 2.1e5, share_pct: 9.7 }],
  rowCount: 3,
  truncated,
});

describe('a total the note gives, held against the sum of a per-row column', () => {
  it('reads a count two columns name from the one named for it alone, as D16\'s swaps and priced_swaps', () => {
    // $2.42M is not 2,425,642.22 by the usual rule, which gives $2.43M
    expect(contradictions(D16_NOTE, 'Uniswap v3 WAVAX/USDC 0.05% fees this week', d16)).toEqual([{
      sentence: 'The pool had 4,978 swaps with $2.42M in volume.',
      error: 'the note gives 4,978 ("The pool had 4,978 swaps with $2.42M in volume."), but the rows\' swaps is 4,981. the note gives $2.42M ("The pool had 4,978 swaps with $2.42M in volume."), but the rows\' volume_usd is $2,425,642.22.',
      fix: 'The pool had 4,981 swaps with $2.43M in volume.',
    }]);
    expect(contradictions('The pool had 4,981 swaps with $2.43M in volume.', 'Uniswap v3 WAVAX/USDC 0.05% fees this week', d16)).toEqual([]);
    // a measure after "in" is the figure's noun: the pool's volume is held against volume_usd
    const later = { ...d16, rows: [{ ...d16.rows[0], swaps: 5436, priced_swaps: 5436, volume_usd: 2585517.58 }] };
    expect(contradictions('The pool had 4,978 swaps with $2.42M in volume.', 'Uniswap v3 WAVAX/USDC 0.05% fees this week', later)[0]).toEqual({
      sentence: 'The pool had 4,978 swaps with $2.42M in volume.',
      error: 'the note gives 4,978 ("The pool had 4,978 swaps with $2.42M in volume."), but the rows\' swaps is 5,436. the note gives $2.42M ("The pool had 4,978 swaps with $2.42M in volume."), but the rows\' volume_usd is $2,585,517.58.',
      fix: 'The pool had 5,436 swaps with $2.59M in volume.',
    });
    expect(contradictions('Fees came to $1.2M in the last week.', 'Uniswap v3 WAVAX/USDC 0.05% fees this week', later)).toEqual([]);
  });

  it('sends back a total of all the rows that their column sums to another figure', () => {
    const [c] = contradictions('Swaps this week came to 4,978 in all.', 'Swaps per protocol this week', perProtocol());
    expect(c.error).toBe('the note gives 4,978 ("Swaps this week came to 4,978 in all."), but the rows\' swaps sum to 4,981.');
    expect(c.fix).toBe('Swaps this week came to 4,981 in all.');
    expect(contradictions('There were 4,978 swaps on the three protocols this week.', 'Swaps per protocol this week', perProtocol())[0].fix).toBe('There were 4,981 swaps on the three protocols this week.');
    expect(contradictions('Volume came to a total of $2.1M.', 'Swaps per protocol this week', perProtocol())[0].fix).toBe('Volume came to a total of $2.4M.');
  });

  it('passes a figure of one row, a rank, a statistic, a bound, a qualified count, a rounded total and cut rows', () => {
    for (const note of [
      'Uniswap had 3,100 swaps.',
      'Blackhole DEX had 500 swaps.',
      'The top protocol had 3,100 swaps.',
      'Each protocol averaged 1,660 swaps.',
      'Over 4,000 swaps this week.',
      '4,978 swaps were over $1k.',
      '3,000 swaps went through one venue.',
      'There were 5k swaps in all.',
      'There were 4,981 swaps in all.',
    ]) expect(contradictions(note, 'Swaps per protocol this week', perProtocol())).toEqual([]);
    expect(contradictions('Swaps this week came to 4,978 in all.', 'Swaps per protocol this week', perProtocol(true))).toEqual([]);
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
const FINAL = { title: 'Aave flash loans this week', note: 'Flash loans on Aave, valued at each hour\'s price. No flash loans were borrowed this week.', sql: 'SELECT sum(usd) AS volume_usd FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now())', chart: { kind: 'table', series: [] } };
const ask = (chainId: number) => answerQuestion({ chainId, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Aave flash loans this week', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

describe('the writer is sent back a note its rows contradict', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue({ ...one('volume_usd', 'Float64', 796.85), elapsedMs: 1, rowsRead: 1, truncated: false });
    results.length = 0;
  });

  it('once, with the rows\' figure, reads the rows it already has again, and leaves out a sentence still against them', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask(43114);
    expect(results[0]).toEqual({ error: 'the note says "No flash loans were borrowed this week.", but the rows hold volume_usd 796.85. Write the note from these rows, and call render_chart again with the same SQL.' });
    expect(results).toHaveLength(2);
    expect(runQuery).toHaveBeenCalledOnce();
    expect(answer?.note).toBe('Flash loans on Aave, valued at each hour\'s price.');
  });

  it('once, for a total the rows hold another figure of, and writes the rows\' figure in when it is still wrong', async () => {
    runQuery.mockReset().mockResolvedValue({ ...l02(48292), elapsedMs: 1, rowsRead: 1, truncated: false });
    vi.mocked(generateText).mockImplementation(writes({ ...FINAL, title: 'Largest Aave borrowers now', note: L02_NOTE, sql: 'SELECT borrower_address, debt_usd, debts, share_pct, count() OVER () AS of_total FROM debts ORDER BY debt_usd DESC LIMIT 15' }));
    const answer = await ask(43114);
    expect(results[0]).toEqual({ error: 'the note gives 48,336 ("The 15 largest borrowers on Aave by debt, of 48,336 total borrowers on the protocol now."), but the rows\' of_total is 48,292. Write the note from these rows, and call render_chart again with the same SQL.' });
    expect(results).toHaveLength(2);
    expect(answer?.note).toBe('The 15 largest borrowers on Aave by debt, of 48,292 total borrowers on the protocol now.');
  });

  it('holds a total against a per-row sum only when the rows are whole', async () => {
    runQuery.mockReset().mockImplementation(async () => ({ ...perProtocol(), elapsedMs: 1, rowsRead: 3 }));
    const swaps = { ...FINAL, title: 'Swaps per protocol this week', note: 'Swaps this week came to 4,978 in all.', sql: 'SELECT protocol, swaps, volume_usd, share_pct FROM x LIMIT 3' };
    vi.mocked(generateText).mockImplementation(writes(swaps));
    expect((await ask(43114))?.note).toBe('Swaps this week came to 4,981 in all.');
    expect(results[0]).toEqual({ error: 'the note gives 4,978 ("Swaps this week came to 4,978 in all."), but the rows\' swaps sum to 4,981. Write the note from these rows, and call render_chart again with the same SQL.' });
    // rows cut at their LIMIT do not sum to the total
    results.length = 0;
    vi.mocked(cutOf).mockReturnValue({ inner: 'SELECT protocol, swaps, volume_usd, share_pct FROM x', limit: 3, newest: false });
    expect((await ask(43114))?.note).toBe('Swaps this week came to 4,978 in all.');
    expect(results).toHaveLength(1);
    vi.mocked(cutOf).mockReturnValue(null);
  });

  it('leaves Fuji\'s note as it was', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask(43113);
    expect(results).toHaveLength(1);
    expect(answer?.note).toBe(FINAL.note);
  });
});
