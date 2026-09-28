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
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { EXAMPLES, PCHAIN_EXAMPLES } from '@/lib/explorer-query/examples';
import { fixedRecipe, fixedRoute } from '@/lib/explorer-query/fixed';
import { guardSql } from '@/lib/explorer-query/guard';

const CCHAIN = EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
const PCHAIN = PCHAIN_EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
const ROWS = { columns: [{ name: 'n', type: 'UInt64' }], rows: [{ n: 1 }], rowCount: 1, elapsedMs: 1, rowsRead: 1, truncated: false };
const ask = (chainId: number, prompt: string) =>
  answerQuestion({ chainId, chainName: chainId === 1 ? 'P-Chain' : 'Avalanche C-Chain', symbol: 'AVAX', prompt, history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

describe('the suggested questions', () => {
  it('each have fixed SQL that passes the guard, with a layout', () => {
    for (const [chainId, qs] of [[43114, CCHAIN], [1, PCHAIN]] as const) {
      for (const q of qs) {
        const r = fixedRecipe(chainId, q);
        expect(r, q).not.toBeNull();
        expect(guardSql(r!.sql, chainId).ok, q).toBe(true);
        expect(r!.visual, q).not.toBeNull();
      }
    }
  });

  it('are found however they are typed, and only on their own chain', () => {
    expect(fixedRecipe(43114, '  busiest SENDERS in the last hour? ')).not.toBeNull();
    expect(fixedRecipe(1, CCHAIN[0])).toBeNull();
    expect(fixedRecipe(43113, CCHAIN[0])).toBeNull();
    expect(fixedRoute(43114, PCHAIN[0])).toBe('p-chain');
    expect(fixedRoute(1, CCHAIN[0])).toBe('c-chain');
    expect(fixedRoute(43114, CCHAIN[0])).toBeNull();
  });
});

describe('a suggestion asked', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset().mockRejectedValue(new Error('no model in this test'));
    runQuery.mockReset().mockResolvedValue(ROWS);
  });

  it('runs its fixed SQL and asks no model, for the layout either', async () => {
    for (const [chainId, qs] of [[43114, CCHAIN], [1, PCHAIN]] as const) {
      for (const q of qs) {
        const a = await ask(chainId, q);
        expect(a?.sql, q).toBe(fixedRecipe(chainId, q)!.sql);
        expect(a?.model?.cached, q).toBe(true);
        // no key and a kept layout: the page asks the designer for nothing
        expect(a?.key, q).toBeUndefined();
        expect(a?.draftVisual, q).toBe(false);
      }
    }
    expect(generateText).not.toHaveBeenCalled();
  });

  it('on the other chain is sent there, with no model', async () => {
    const a = await ask(43114, PCHAIN[0]);
    expect(a?.route).toBe('p-chain');
    expect(runQuery).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('goes to the model when its fixed SQL finds nothing, and a free question always does', async () => {
    runQuery.mockResolvedValue({ ...ROWS, rows: [], rowCount: 0 });
    await ask(43114, CCHAIN[0]);
    expect(generateText).toHaveBeenCalledTimes(1);
    runQuery.mockResolvedValue(ROWS);
    await ask(43114, 'Transactions per hour today');
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
