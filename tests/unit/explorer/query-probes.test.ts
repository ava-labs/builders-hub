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
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));
vi.mock('@/lib/explorer-query/examples', () => ({ PCHAIN_EXAMPLES: [], examplesFor: vi.fn(() => []) }));

import { generateText } from 'ai';
import { TESTS, WRITERS, answerQuestion, type QueryEvent } from '@/lib/explorer-query/answer';

const ROWS = { columns: [{ name: 't', type: 'DateTime' }, { name: 'swaps', type: 'UInt64' }], rows: [{ t: '2026-09-27 00:00:00', swaps: 2 }], rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false };
const FINAL = { title: 'Swaps per hour', note: 'Swaps on the C-Chain.', sql: 'SELECT t, swaps FROM x', chart: { kind: 'bar', x: 't', series: [{ column: 'swaps', label: 'Swaps' }] } };

// the SDK's loop around a model that calls run_sql on every step, and render_chart only when the step's tool
// choice names it: the SDK still runs a tool that activeTools leaves out, as the audits' long loops showed
type Run = { choices: unknown[]; results: unknown[]; description?: string; chart?: string };
type Call = {
  tools: { run_sql: { description?: string; execute: (input: unknown, o: unknown) => Promise<unknown> }; render_chart: { description?: string; execute: (input: unknown, o: unknown) => Promise<unknown> } };
  toolChoice: unknown;
  stopWhen: ((o: { steps: unknown[] }) => boolean | PromiseLike<boolean>)[];
  prepareStep: (o: { stepNumber: number; steps: unknown[]; messages: unknown[] }) => { toolChoice?: { type: string; toolName?: string } } | undefined;
  onStepFinish: (s: unknown) => void;
};
const runs: Run[] = [];
const writer = (final: object) =>
  (async (opts: Call) => {
    const steps: unknown[] = [];
    const run: Run = { choices: [], results: [], description: opts.tools.run_sql.description, chart: opts.tools.render_chart.description };
    runs.push(run);
    for (let n = 0; ; n++) {
      const p = await opts.prepareStep({ stepNumber: n, steps, messages: [{ role: 'user', content: 'q' }] });
      run.choices.push(p?.toolChoice ?? opts.toolChoice);
      const answers = p?.toolChoice?.toolName === 'render_chart';
      run.results.push(await (answers ? opts.tools.render_chart.execute(final, {}) : opts.tools.run_sql.execute({ sql: 'SELECT t, swaps FROM x' }, {})));
      steps.push({});
      opts.onStepFinish({});
      if ((await Promise.all(opts.stopWhen.map((s) => s({ steps })))).some(Boolean)) break;
    }
    return { totalUsage: { inputTokens: 0, inputTokenDetails: { cacheReadTokens: 0 } } };
  }) as unknown as typeof generateText;

const ask = async (chainId: number) => {
  const events: QueryEvent[] = [];
  const answer = await answerQuestion({ chainId, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Swaps per hour today', history: [], baseUrl: 'http://localhost:3000', emit: (e) => events.push(e) });
  return { answer, events, error: events.find((e) => e.type === 'error') };
};
const tests = () => runQuery.mock.calls.filter(([sql]) => /^SELECT \* FROM \(/.test(String(sql))).length;
const forced = { type: 'tool', toolName: 'render_chart' };

describe('the writer tests a set number of times, then answers', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    runQuery.mockReset();
    runs.length = 0;
  });

  it('is told how many tests are left, and answers from what they showed once they are spent', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    const { answer, error } = await ask(43114);
    expect(error).toBeUndefined();
    expect(answer?.result?.rowCount).toBe(1);
    expect(runs).toHaveLength(1);
    expect(tests()).toBe(TESTS);
    expect(runs[0].results.slice(0, TESTS).map((r) => (r as { testsLeft?: number }).testsLeft)).toEqual(Array.from({ length: TESTS }, (_, i) => TESTS - 1 - i));
    // the step after the last test can only answer
    expect(runs[0].choices).toEqual([...Array(TESTS).fill('required'), forced]);
    expect(answer?.model).toMatchObject({ steps: TESTS + 1, tries: TESTS });
  });

  it('says it ran out of steps when no answer comes of the tests, not that the database failed', async () => {
    runQuery.mockResolvedValue(ROWS);
    // a final whose chart names a column the rows do not have never passes
    vi.mocked(generateText).mockImplementation(writer({ ...FINAL, chart: { ...FINAL.chart, x: 'hour' } }));
    const { answer, error } = await ask(43114);
    expect(answer).toBeNull();
    // each writer tests only its share, then spends the rest of its steps on answers
    expect(runs.map((r) => r.results.length)).toEqual([WRITERS.fast.steps, WRITERS.full.steps]);
    expect(tests()).toBe(2 * TESTS);
    expect(error).toMatchObject({ status: 422, error: expect.stringContaining('ran out of steps') });
    expect(error && 'error' in error ? error.error : '').not.toContain('database');
  });

  it('names the database only when every query failed on it', async () => {
    runQuery.mockRejectedValue(new Error('Code: 241. Memory limit exceeded'));
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    const { error } = await ask(43114);
    expect(error).toMatchObject({ status: 422, error: expect.stringContaining('kept failing on the database') });
  });

  it('asks a C-Chain writer for the shorthand in both tools, and leaves Fuji\'s tools as they were', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    await ask(43114);
    expect(runs[0].description).toMatch(/ Write a shorthand \(\$DEX, \$LEND, \$LIQUIDATIONS\) as it stands, never the WITH it stands for: the server writes its WITH out\.$/);
    expect(runs[0].chart).toMatch(/ Write sql and drill\.sql with the shorthand your tests used \(\$DEX, \$LEND, \$LIQUIDATIONS\): the server writes its WITH out\.$/);
    runs.length = 0;
    await ask(43113);
    expect(runs[0].description).toBe('Test a query you are unsure of: the first rows and column types, or the database error. Skip it when a worked example fits.');
    expect(runs[0].chart).toBe('Hand back the final query and the chart spec. The server runs the query in full and tests the drill. Returns ok, or the error to fix.');
  });

  it('keeps Fuji as it was: no budget, no forced answer, and the old words', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    const { answer, error } = await ask(43113);
    expect(answer).toBeNull();
    // the model tests on every step, as before: the last steps only narrow its list of tools
    expect(tests()).toBe(WRITERS.fast.steps + WRITERS.full.steps);
    expect(runs.flatMap((r) => r.choices).every((c) => c === 'required')).toBe(true);
    expect(runs[0].results.every((r) => !('testsLeft' in (r as object)))).toBe(true);
    expect(error).toMatchObject({ status: 422, error: expect.stringContaining('kept failing on the database') });
  });
});
