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
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn((t: string, row: Record<string, unknown>) => ({ ok: true, sql: t.replace('{{token}}', `'${String(row.token)}'`) })), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/examples', () => ({ PCHAIN_EXAMPLES: [], examplesFor: vi.fn(() => []) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';

const ROWS = { columns: [{ name: 'token', type: 'String' }, { name: 'volume_usd', type: 'Float64' }], rows: [{ token: '0xabc', volume_usd: 796.85 }], rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false };
// a note the rows contradict, so the first final is sent back after its drill was probed
const FINAL = { title: 'Aave flash loans this week', note: 'Flash loans on Aave. No flash loans were borrowed this week.', sql: 'SELECT token, sum(usd) AS volume_usd FROM loans GROUP BY token', chart: { kind: 'table', series: [] }, drill: { sql: 'SELECT tx FROM loans WHERE token = {{token}} LIMIT 50', title: 'Loans of {{token}}' } };

// a writer that hands render_chart the next final on each step, the last one again after the end
type Call = { tools: { render_chart: { execute: (input: unknown, o: unknown) => Promise<unknown> } }; stopWhen: ((o: { steps: unknown[] }) => boolean | PromiseLike<boolean>)[]; onStepFinish: (s: unknown) => void };
const writes = (...finals: object[]) =>
  (async (opts: Call) => {
    const steps: unknown[] = [];
    do {
      await opts.tools.render_chart.execute(finals[Math.min(steps.length, finals.length - 1)], {});
      steps.push({});
      opts.onStepFinish({});
    } while (!(await Promise.all(opts.stopWhen.map((s) => s({ steps })))).some(Boolean));
    return { totalUsage: { inputTokens: 0, inputTokenDetails: { cacheReadTokens: 0 } } };
  }) as unknown as typeof generateText;
const ask = () => answerQuestion({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Aave flash loans this week', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });
const probes = () => runQuery.mock.calls.filter(([sql]) => /FROM loans WHERE token/.test(String(sql))).map(([sql]) => String(sql));

describe('a drill that found records in this request', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue(ROWS);
  });

  it('is not probed again when a final sent back hands back the same drill', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await ask();
    expect(answer?.drill?.sql).toBe(FINAL.drill.sql);
    expect(probes()).toEqual(["SELECT tx FROM loans WHERE token = '0xabc' LIMIT 1"]);
    // the main query ran once too: the second final reads the rows it already has
    expect(runQuery).toHaveBeenCalledTimes(2);
  });

  it('is probed again when the drill is not byte for byte the same', async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL, { ...FINAL, drill: { ...FINAL.drill, sql: 'SELECT tx, usd FROM loans WHERE token = {{token}} LIMIT 50' } }));
    await ask();
    expect(probes()).toEqual(["SELECT tx FROM loans WHERE token = '0xabc' LIMIT 1", "SELECT tx, usd FROM loans WHERE token = '0xabc' LIMIT 1"]);
  });
});
