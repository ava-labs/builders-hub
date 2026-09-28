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
vi.mock('@/lib/explorer-query/checks', () => ({ protocolScope: vi.fn(() => null), oneProtocol: vi.fn(() => null), unitName: vi.fn(() => null) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/examples', () => ({ PCHAIN_EXAMPLES: [], examplesFor: vi.fn(() => []) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { contradictions, withoutContradictions } from '@/lib/explorer-query/claims';

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

  it('leaves Fuji\'s note as it was', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask(43113);
    expect(results).toHaveLength(1);
    expect(answer?.note).toBe(FINAL.note);
  });
});
