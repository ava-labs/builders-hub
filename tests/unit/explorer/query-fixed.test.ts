import { beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());
const withSources = vi.hoisted(() => vi.fn(async (sql: string) => ({ sql, sources: [] })));
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
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []), withSources }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { EXAMPLES, L1_EXAMPLES, PCHAIN_EXAMPLES } from '@/lib/explorer-query/examples';
import { fixedRecipe, fixedRoute } from '@/lib/explorer-query/fixed';
import { guardSql } from '@/lib/explorer-query/guard';

const CCHAIN = EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
const PCHAIN = PCHAIN_EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
const L1 = L1_EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
// Gunzilla and Dexalot on mainnet, and Dexalot's L1 on Fuji
const GUNZILLA = 43419;
const DEXALOT = 432204;
const DEXALOT_FUJI = 432201;
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

  it('on an L1 are one set, filled in with the asked chain and its token', () => {
    for (const [chainId, symbol] of [[GUNZILLA, 'GUN'], [DEXALOT, 'ALOT']] as const) {
      for (const q of L1) {
        const r = fixedRecipe(chainId, q, symbol);
        expect(r, q).not.toBeNull();
        expect(guardSql(r!.sql, chainId).ok, q).toBe(true);
        expect(r!.sql, q).toContain(`chain_id = ${chainId}`);
        for (const sql of [r!.sql, r!.drill?.sql ?? '']) expect(sql, q).not.toMatch(/\{chain\}|\{fee\}/);
        // a layout made on one chain says nothing of its figures on another
        expect(r!.visual?.callouts, q).toEqual([]);
      }
    }
    expect(fixedRecipe(DEXALOT, 'Busiest senders this week', 'ALOT')!.drill!.sql).toContain(' AS fee_alot,');
    expect(fixedRecipe(DEXALOT, 'Busiest senders this week')!.drill!.sql).toContain(' AS fee_native,');
    // a sender's partners are the addresses it sent to, which are often wallets, never "contracts"
    expect(fixedRecipe(GUNZILLA, 'Busiest senders this week')!.sql).toContain('uniqExact(`to`) AS recipients,');
    // a token's senders are the addresses its Transfers move it from, the zero address (a mint) left out
    expect(fixedRecipe(GUNZILLA, 'Token contracts by transfers this week')!.sql).toContain("uniqExactIf(topic1, topic1 != unhex(repeat('00', 32))) AS senders,");
  });

  it('leave a Fuji L1, an unknown chain and the C-Chain to their own questions', () => {
    expect(fixedRecipe(DEXALOT_FUJI, L1[0], 'ALOT')).toBeNull();
    expect(fixedRecipe(999_999_999, L1[0])).toBeNull();
    expect(fixedRecipe(43114, L1[0])).toBeNull();
    expect(fixedRecipe(1, L1[0])).toBeNull();
  });
});

describe('a suggestion asked', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset().mockRejectedValue(new Error('no model in this test'));
    runQuery.mockReset().mockResolvedValue(ROWS);
  });

  it('runs its fixed SQL and asks no model, for the layout either', async () => {
    for (const [chainId, qs] of [[43114, CCHAIN], [1, PCHAIN], [GUNZILLA, L1]] as const) {
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

  it("gives a snapshot's figures the snapshot's time, read after the rows by its own subquery", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-09-28T12:00:00Z'));
    const time = (at: string) => ({ ...ROWS, columns: [{ name: 'at', type: 'DateTime' }], rows: [{ at }] });
    runQuery.mockImplementation(async (sql: string) => (sql.startsWith('SELECT (SELECT max(snapshot_time)') ? time('2026-09-28 11:45:00') : ROWS));
    const a = await ask(1, 'L1s by active validators, with the balance left for fees');
    expect(a?.span).toBe('as of 11:45 UTC');
    // one query at a time: the rows, then the time
    const pick = 'SELECT (SELECT max(snapshot_time) FROM p_l1_validator_snapshots WHERE chain_id = 1 AND snapshot_time <= now() - INTERVAL 15 MINUTE AND snapshot_time >= now() - INTERVAL 1 DAY) AS at';
    expect(runQuery.mock.calls.map(([sql]) => sql)).toEqual([a?.sql, pick]);
    // the time's own read has its tables defined as the run's are (sources.ts)
    expect(withSources).toHaveBeenCalledWith(pick, 1);
    // a snapshot a day old names its day, and a time that fails to come names none
    runQuery.mockImplementation(async (sql: string) => (sql.startsWith('SELECT (SELECT') ? time('2026-09-27 11:45:00') : ROWS));
    expect((await ask(1, 'Validators whose staking period ends in the next 7 days'))?.span).toBe('as of September 27, 11:45 UTC');
    runQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT (SELECT')) throw new Error('stats-api 503');
      return ROWS;
    });
    expect((await ask(1, 'Largest validators right now, with delegators and uptime'))?.span).toBeNull();
    // an answer over a window reads no time of its own
    runQuery.mockReset().mockResolvedValue(ROWS);
    expect((await ask(43114, 'Fees burned per 5 minutes'))?.span).toBe('last 6 hours');
    expect(runQuery).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('on the other chain is sent there, with no model', async () => {
    const a = await ask(43114, PCHAIN[0]);
    expect(a?.route).toBe('p-chain');
    expect(runQuery).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  // a model runs only for what a reader typed: a suggestion that finds nothing says so
  it('answers with no rows when its fixed SQL finds nothing, and a free question goes to the model', async () => {
    runQuery.mockResolvedValue({ ...ROWS, rows: [], rowCount: 0 });
    for (const [chainId, q] of [[43114, CCHAIN[0]], [DEXALOT, L1[0]]] as const) {
      const a = await ask(chainId, q);
      expect(a?.result?.rowCount, q).toBe(0);
      expect(a?.model?.writer, q).toBe('fixed SQL');
    }
    expect(generateText).not.toHaveBeenCalled();
    runQuery.mockResolvedValue(ROWS);
    await ask(43114, 'Transactions per hour today');
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
