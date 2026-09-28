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
import { FUJI_WRITERS, PROSE_BACK, TESTS, TOOLS_ONLY, WRITERS, answerQuestion, type QueryEvent } from '@/lib/explorer-query/answer';
import { userTurn } from '@/lib/explorer-query/prompt';

const ROWS = { columns: [{ name: 't', type: 'DateTime' }, { name: 'swaps', type: 'UInt64' }], rows: [{ t: '2026-09-27 00:00:00', swaps: 2 }], rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false };
const FINAL = { title: 'Swaps per hour', note: 'Swaps on the C-Chain.', sql: 'SELECT t, swaps FROM x', chart: { kind: 'bar', x: 't', series: [{ column: 'swaps', label: 'Swaps' }] } };

// the SDK's loop around a model that calls run_sql on every step, and render_chart only when the step's tool
// choice names it: the SDK still runs a tool that activeTools leaves out, as the audits' long loops showed. On auto
// (a model that refuses a forced call) it answers once its tests are spent, as run_sql then tells it to
type Run = { choices: unknown[]; results: unknown[]; description?: string; chart?: string; tools: unknown[]; cap?: number; effort?: string; last?: unknown };
type Call = {
  tools: { run_sql: { description?: string; execute: (input: unknown, o: unknown) => Promise<unknown> }; render_chart: { description?: string; execute: (input: unknown, o: unknown) => Promise<unknown> } };
  toolChoice: unknown;
  maxOutputTokens?: number;
  messages: { content: unknown }[];
  providerOptions?: { anthropic?: { effort?: string } };
  stopWhen: ((o: { steps: unknown[] }) => boolean | PromiseLike<boolean>)[];
  prepareStep: (o: { stepNumber: number; steps: unknown[]; messages: unknown[] }) => { toolChoice?: { type: string; toolName?: string }; activeTools?: string[] } | undefined;
  onStepFinish: (s: unknown) => void;
};
const runs: Run[] = [];
const USAGE = { inputTokens: 0, inputTokenDetails: { cacheReadTokens: 0 } };
// its first `prose` calls reply in prose: one step, with no tool call
const writer = (final: object, prose = 0) => {
  let told = prose;
  return (async (opts: Call) => {
    const steps: { toolCalls: unknown[] }[] = [];
    const run: Run = { choices: [], results: [], description: opts.tools.run_sql.description, chart: opts.tools.render_chart.description, tools: [], cap: opts.maxOutputTokens, effort: opts.providerOptions?.anthropic?.effort, last: opts.messages.at(-1)?.content };
    runs.push(run);
    if (told > 0) {
      told -= 1;
      opts.onStepFinish({});
      return { steps: [{ toolCalls: [] }], response: { messages: [{ role: 'assistant', content: 'SELECT t, swaps FROM x' }] }, totalUsage: USAGE };
    }
    let tested = 0;
    for (let n = 0; ; n++) {
      const p = await opts.prepareStep({ stepNumber: n, steps, messages: [{ role: 'user', content: 'q' }] });
      const choice = p?.toolChoice ?? opts.toolChoice;
      run.choices.push(choice);
      run.tools.push(p?.activeTools ?? 'all');
      const answers = p?.toolChoice?.toolName === 'render_chart' || (choice === 'auto' && tested >= TESTS);
      if (!answers) tested += 1;
      run.results.push(await (answers ? opts.tools.render_chart.execute(final, {}) : opts.tools.run_sql.execute({ sql: 'SELECT t, swaps FROM x' }, {})));
      steps.push({ toolCalls: [{}] });
      opts.onStepFinish({});
      if ((await Promise.all(opts.stopWhen.map((s) => s({ steps })))).some(Boolean)) break;
    }
    return { steps, response: { messages: [] }, totalUsage: USAGE };
  }) as unknown as typeof generateText;
};

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
    // Sonnet 5.5 refuses a forced call: it runs on auto, told on the question turn to reply in tool calls
    expect(runs[0].choices).toEqual(Array(TESTS + 1).fill('auto'));
    expect(runs[0].tools).toEqual(Array(TESTS + 1).fill('all'));
    expect(runs[0].last).toBe(`Swaps per hour today\n\n${TOOLS_ONLY}`);
    expect(runs[0].effort).toBe('low');
    expect(answer?.model).toMatchObject({ steps: TESTS + 1, tries: TESTS });
  });

  it('forces the answer from a model that takes a forced call, once its tests are spent', async () => {
    const kept = { ...WRITERS };
    Object.assign(WRITERS, FUJI_WRITERS);
    try {
      runQuery.mockResolvedValue(ROWS);
      vi.mocked(generateText).mockImplementation(writer(FINAL));
      const { answer, error } = await ask(43114);
      expect(error).toBeUndefined();
      expect(answer?.result?.rowCount).toBe(1);
      // the step after the last test can only answer, with the tools every step before had, so it reads the prompt cache
      expect(runs[0].choices).toEqual([...Array(TESTS).fill('required'), forced]);
      expect(runs[0].tools).toEqual(Array(TESTS + 1).fill('all'));
      expect(runs[0].last).toBe('Swaps per hour today');
      expect(runs[0].effort).toBeUndefined();
    } finally {
      Object.assign(WRITERS, kept);
    }
  });

  it('sends a reply in prose back once, with the steps its writer has left', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL, 1));
    const { answer, error } = await ask(43114);
    expect(error).toBeUndefined();
    expect(answer?.result?.rowCount).toBe(1);
    expect(runs.map((r) => r.last)).toEqual([`Swaps per hour today\n\n${TOOLS_ONLY}`, PROSE_BACK]);
    expect(answer?.model?.timings.map((t) => t.detail)).toContain('replied in prose, not a tool call');
    runs.length = 0;
    // a final that never passes spends every step: the prose took one of the fast writer's
    vi.mocked(generateText).mockImplementation(writer({ ...FINAL, chart: { ...FINAL.chart, x: 'hour' } }, 1));
    await ask(43114);
    expect(runs.map((r) => r.results.length)).toEqual([0, WRITERS.fast.steps - 1, WRITERS.full.steps]);
  });

  it('hands the question to the full writer when a reply sent back comes back in prose', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL, 2));
    const { answer, error } = await ask(43114);
    expect(error).toBeUndefined();
    expect(runs.map((r) => r.effort)).toEqual(['low', 'low', 'medium']);
    expect(answer?.model?.writer).toBe(WRITERS.full.label);
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

  it('gives every writer an output cap of its own, and sends it with each mainnet call', async () => {
    // the SDK gives a model it does not know 4096 tokens: a writer without a cap of its own fails here
    for (const w of Object.values(WRITERS)) expect(w.maxOutputTokens, w.id).toBeGreaterThan(4096);
    runQuery.mockResolvedValue(ROWS);
    // a final that never passes runs both writers
    vi.mocked(generateText).mockImplementation(writer({ ...FINAL, chart: { ...FINAL.chart, x: 'hour' } }));
    await ask(43114);
    expect(runs.map((r) => r.cap)).toEqual([WRITERS.fast.maxOutputTokens, WRITERS.full.maxOutputTokens]);
    runs.length = 0;
    await ask(43113);
    expect(runs.map((r) => r.cap)).toEqual([undefined, undefined]);
  });

  it('tells a question on its own its series default, and not a follow-up, which keeps its chart\'s window', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    vi.mocked(userTurn).mockClear();
    await ask(43114);
    const history = [{ prompt: 'Swaps per hour today', sql: 'SELECT t, swaps FROM x', title: 'Swaps per hour' }];
    await answerQuestion({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'make it weekly', history, baseUrl: 'http://localhost:3000', emit: () => {} });
    expect(vi.mocked(userTurn).mock.calls.map((c) => c[3])).toEqual([true, false]);
  });

  it('keeps Fuji as it was: no budget, no forced answer, and the old words', async () => {
    runQuery.mockResolvedValue(ROWS);
    vi.mocked(generateText).mockImplementation(writer(FINAL));
    const { answer, error } = await ask(43113);
    expect(answer).toBeNull();
    // the model tests on every step, as before: the last steps only narrow its list of tools
    expect(tests()).toBe(FUJI_WRITERS.fast.steps + FUJI_WRITERS.full.steps);
    expect(runs.flatMap((r) => r.choices).every((c) => c === 'required')).toBe(true);
    // its writers are the ones it had, with no effort and no line on the question turn
    expect(runs.map((r) => [r.effort, r.last])).toEqual([[undefined, 'Swaps per hour today'], [undefined, 'Swaps per hour today']]);
    expect(runs[0].tools.slice(-2)).toEqual([['render_chart'], ['render_chart']]);
    expect(runs[0].results.every((r) => !('testsLeft' in (r as object)))).toBe(true);
    expect(error).toMatchObject({ status: 422, error: expect.stringContaining('kept failing on the database') });
  });
});
