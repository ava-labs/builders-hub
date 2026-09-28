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
import { absurdFigure, ceilingOf } from '@/lib/explorer-query/magnitude';

const rows = (name: string, type: string, ...values: unknown[]) => ({ columns: [{ name, type }], rows: values.map((v) => ({ [name]: v })) });

describe('a figure too large to be true', () => {
  it('names the column and row of a fee in dollars past a trillion, as a D16 run gave 2.0e287', () => {
    const why = absurdFigure(rows('fee_usd', 'Float64', 12.5, 2.0e287), 43114);
    expect(why).toMatch(/^fee_usd is 2e\+287 in row 2\. No figure in dollars on the C-Chain comes near a trillion \(1e12\)/);
    expect(why).toContain('Call render_chart again unchanged only if the figure is right.');
  });

  it('names token amounts past a quadrillion units: a raw amount, and a signed one read as unsigned', () => {
    // D07v12 showed the raw amounts of a swap, and L05e summed unsigned words over tokens
    const d07 = { columns: [{ name: 'amount0', type: 'Float64' }, { name: 'amount1', type: 'Float64' }], rows: [{ amount0: 5.498635491578654e21, amount1: 60029177267 }, { amount0: 12, amount1: 1.5578846783388697e21 }] };
    expect(absurdFigure(d07, 43114)).toMatch(/^amount0 is 5\.498635491578654e\+21 in row 1, and amount1 is 1\.5578846783388697e\+21 in row 2\. /);
    expect(absurdFigure(rows('net_flow', 'Float64', -6.80564733841877e38), 43114)).toMatch(/^net_flow is -6\.80564733841877e\+38 in row 1\. /);
    // a big integer comes back as text
    expect(absurdFigure(rows('amount', 'UInt256', '5498635491578654000000'), 43114)).toMatch(/^amount is 5498635491578654000000 in row 1\. /);
  });

  it('passes the largest true figures the audits saw, and columns in raw units, counts and ratios', () => {
    expect(absurdFigure(rows('volume_usd', 'Float64', 2.441e9), 43114)).toBeNull();
    expect(absurdFigure(rows('pchain_supply_avax', 'Float64', 4.748e8), 43114)).toBeNull();
    expect(absurdFigure(rows('value_wei', 'UInt256', '1000000000000000000000'), 43114)).toBeNull();
    expect(absurdFigure(rows('total_repay_raw', 'Float64', 2.251e24), 43114)).toBeNull();
    expect(absurdFigure(rows('gas_used', 'UInt64', 3e16), 43114)).toBeNull();
    expect(absurdFigure(rows('price', 'Float64', 1e18), 43114)).toBeNull();
    expect(absurdFigure(rows('swaps', 'UInt64', 1e16), 43114)).toBeNull();
    // a hex word is never read as a figure
    expect(absurdFigure(rows('amount', 'String', '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'), 43114)).toBeNull();
    expect([ceilingOf('avax_price_usd'), ceilingOf('volume_usdc'), ceilingOf('netFlowUsd'), ceilingOf('staked_avax'), ceilingOf('share_pct')]).toEqual([1e12, 1e12, 1e12, 1e15, null]);
  });

  it('leaves Fuji\'s rows unread', () => {
    expect(absurdFigure(rows('fee_usd', 'Float64', 2.0e287), 43113)).toBeNull();
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
const FINAL = { title: 'Uniswap v3 fees today', note: 'Fees of every Uniswap v3 swap today, in dollars.', sql: 'SELECT sum(fee) AS fee_usd FROM raw_logs WHERE chain_id = 43114 AND block_time >= toStartOfDay(now())', chart: { kind: 'table', series: [] } };
const ask = (chainId: number) => answerQuestion({ chainId, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Uniswap v3 fees today', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

describe('the writer is sent back a figure too large to be true', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue({ ...rows('fee_usd', 'Float64', 2.0e287), rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false });
    results.length = 0;
  });

  it('once, naming the column, and the answer ships when the writer keeps it', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask(43114);
    expect(results[0]).toEqual({ error: expect.stringMatching(/^fee_usd is 2e\+287 in row 1\. /) });
    expect(results).toHaveLength(2);
    expect(results[1]).toEqual({ ok: true, rows: 1 });
    expect(answer?.result?.rows).toEqual([{ fee_usd: 2.0e287 }]);
  });

  it('leaves Fuji\'s answer as it was', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    await ask(43113);
    expect(results).toHaveLength(1);
  });
});
