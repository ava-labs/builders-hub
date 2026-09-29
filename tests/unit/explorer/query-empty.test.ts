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

// stats-api gives an empty result no column list
const EMPTY = { columns: [], rows: [], rowCount: 0, elapsedMs: 1, rowsRead: 0, truncated: false };
// L04: liquidations since Monday, at 04:51 UTC on a Monday with none yet
const FINAL = { title: 'Liquidations this week', note: 'No liquidations on Aave or Benqi since Monday.', sql: "$LIQUIDATIONS(toMonday(now())) SELECT lower(concat('0x', hex(borrower))) AS borrower_address, protocol, round(sum(debt_usd), 2) AS total_debt_usd, count() AS liquidations_count FROM liquidations GROUP BY borrower_address, protocol ORDER BY total_debt_usd DESC", chart: { kind: 'hbar', x: 'borrower_address', series: [{ column: 'total_debt_usd', label: 'Debt repaid' }] } };

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
const ask = (chainId: number) => answerQuestion({ chainId, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Liquidations this week: who was liquidated and for how much?', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

describe('an answer that is no rows', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue(EMPTY);
    results.length = 0;
  });

  it('ships its own query and chart once the writer keeps them: an empty result has no columns to check the chart on', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask(43114);
    expect(results).toEqual([{ error: expect.stringMatching(/^the query returned no rows\./) }, { ok: true, rows: 0 }]);
    expect(answer?.sql).toBe(FINAL.sql);
    expect(answer?.chart.x).toBe('borrower_address');
    expect(answer?.result?.rowCount).toBe(0);
  });

  it('still checks a chart against the columns of a result that has them', async () => {
    runQuery.mockResolvedValue({ ...EMPTY, columns: [{ name: 'borrower_address', type: 'String' }, { name: 'debt_usd', type: 'Float64' }] });
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    await ask(43114);
    expect(results[1]).toEqual({ error: 'chart refers to columns the query does not return: total_debt_usd' });
  });

  it('keeps Fuji\'s check as it was', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    await ask(43113);
    expect(results[1]).toEqual({ error: 'chart refers to columns the query does not return: borrower_address, total_debt_usd' });
  });
});
