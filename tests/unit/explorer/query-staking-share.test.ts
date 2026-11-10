import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The staked share of the AVAX supply. A tester asked the mainnet P-Chain "has the % of circulating avax staked
   increased since the helicon upgrade": the writer read p_avax_supply as the only supply, one row with no history,
   and gave no chart in 6 of 6 runs. */

const { runQuery } = vi.hoisted(() => ({ runQuery: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery,
  anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })),
  schemaCard: vi.fn(async () => ''),
  coverage: vi.fn(async () => null),
  coverageText: vi.fn(() => ''),
  networkCoverageText: vi.fn(async () => null),
}));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putRecipe: vi.fn(async () => {}), recipeKey: vi.fn(() => 'key') }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { guardSql } from '@/lib/explorer-query/guard';
import { pchainPrompt, shareTurn, userTurn } from '@/lib/explorer-query/prompt';

const NOW = Date.parse('2026-10-16T15:00:00Z');
const PRIMARY = "unhex(repeat('00', 32))";
const FROM = "toDate('2026-09-22') - INTERVAL 30 DAY";
/** the answer the writer gave to the question on the dev server, 2026-10-16, as the worked example writes it */
const SHARE = `WITH snaps AS (SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = 1 AND subnet_id = ${PRIMARY} AND snapshot_time >= ${FROM} AND snapshot_time <= now() - INTERVAL 15 MINUTE GROUP BY snapshot_time UNION ALL SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1 AND snapshot_time >= ${FROM}), daily AS (SELECT toDate(snapshot_time) AS t, toNullable(argMax(staked, snapshot_time)) AS staked_avax FROM snaps GROUP BY t) SELECT s.t AS t, d.staked_avax AS staked_avax, s.circulating_supply_avax AS circulating_avax, round(100 * d.staked_avax / s.circulating_supply_avax, 2) AS staked_pct FROM p_avax_supply_daily AS s LEFT JOIN daily AS d ON d.t = s.t WHERE s.chain_id = 1 AND s.t >= ${FROM} ORDER BY t`;
const QUESTION = 'has the % of circulating avax staked increased since the helicon upgrade';
/** wordings of the same question: each must plan the same answer */
const SAME = [
  QUESTION,
  'did the staked share of circulating AVAX go up after Helicon?',
  'percentage of circulating supply staked before vs after the Helicon upgrade',
  'is more of the AVAX supply staked now than before Helicon',
  'staking ratio since helicon',
  'how much of the supply is staked compared to before the last upgrade',
  '% avax staked pre/post helicon',
  'has staking participation dropped after the upgrade',
];

describe('a question about how much of the supply is staked', () => {
  it('is told its base in its turn, however it is worded', () => {
    const turns = SAME.map((q) => shareTurn(1, q));
    expect(new Set(turns).size, turns.join('\n')).toBe(1);
    expect(turns[0]).toContain("divides each day's Primary Network stake by that day's p_avax_supply_daily.circulating_supply_avax");
    // the whole turn is the same for each: the share's base and Helicon's activation
    const whole = new Set(SAME.map((q) => userTurn(1, q, new Date(NOW)).split('\n\n')[0]));
    expect(whole.size, [...whole].join('\n')).toBe(1);
  });

  it('is not a share of the stake itself, or a stake with no share', () => {
    for (const q of ['share of stake held by the top 10 validators', 'what % of stake is delegated', 'staked AVAX per day', 'validators now', 'delegations per day', 'share of transactions by type']) expect(shareTurn(1, q), q).toBe('');
    // Fuji has no supply per day
    expect(shareTurn(5, QUESTION)).toBe('');
  });
});

describe('the mainnet P-Chain prompt', () => {
  const main = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
  const fuji = pchainPrompt({ chainId: 5, network: 'fuji', schema: '', coverage: null, lines: null });

  it('gives the supply a history, its base for a share, and no longer says it has none', () => {
    // the versions table still has none; the supply's line no longer says so
    expect(main).not.toMatch(/- p_avax_supply: [^\n]*no history/);
    expect(main).toContain('circulating_supply_avax (which the Data API counts as equal to total_supply_avax)');
    expect(main).toContain('- p_avax_supply_daily: the AVAX supply at the end of each day (t)');
    expect(main).toContain('a share of the supply divides by that, never by the P-Chain supply');
    expect(main).toContain(SHARE);
  });

  it('answers the part of a question the tables hold before it answers none', () => {
    expect(main).toContain('4. If no table holds any part of the question, call render_chart with kind "none"');
    expect(main).toContain('If the tables hold part of it, chart that part');
  });

  it("leaves Fuji's as it was", () => {
    for (const t of ['p_avax_supply', 'If no table holds any part']) expect(fuji, t).not.toContain(t);
    expect(fuji).toContain('4. If the question cannot be answered from these tables, call render_chart with kind "none" and say why in the note.');
    expect(fuji).toContain('## Tables (from the database, and p_validator_versions, which our server sends with the query');
  });
});

describe('the staked share query', () => {
  it('passes the guard on the mainnet P-Chain and reads nothing on Fuji', () => {
    expect(guardSql(SHARE, 1).ok).toBe(true);
    expect(guardSql(SHARE.replace(/chain_id = 1/g, 'chain_id = 5'), 5).ok).toBe(false);
  });
});

describe('the supply per day our server builds', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        new URL(String(url)).pathname === '/v1/avax/supply'
          ? Response.json({ totalSupply: '468647013.18', circulatingSupply: '468647013.18', totalStaked: '204627887.06', totalLocked: '27921780.13', totalRewards: '113820230.02', totalPBurned: '19430.1', totalCBurned: '5108165.63', totalXBurned: '45621.11', l1ValidatorFees: '18151.28', genesisUnlock: '360000000', lastUpdated: '2026-10-16T14:15:16.895Z' })
          : new Response('not found', { status: 404 }),
      ),
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const fresh = async () => {
    vi.resetModules();
    return import('@/lib/explorer-query/sources');
  };

  it('rebuild the supply per day from the Data API total less the rewards paid after each day, over the query window', async () => {
    const { sql, sources } = await (await fresh()).withSources(SHARE, 1);
    expect(sql).toContain('p_avax_supply_daily AS (SELECT toUInt8(1) AS chain_id, t, toFloat64(468647013.18) - ifNull(sum(paid) OVER (ORDER BY t DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS total_supply_avax, total_supply_avax AS circulating_supply_avax FROM (');
    // a day before the window's start, up to when the Data API counted
    expect(sql).toContain("FROM raw_p_reward_utxos WHERE chain_id = 1 AND block_time >= toDateTime('2026-08-22 00:00:00', 'UTC') AND block_time <= toDateTime('2026-10-16 14:15:16', 'UTC')");
    expect(sources.map((s) => s.table)).toEqual(['p_avax_supply_daily', 'p_stake_fill']);
    expect(sources[0].text).toBe(
      "The supply on each day is rebuilt: the Avalanche Data API's total supply at 2026-10-16 14:15 UTC, less the staking rewards paid after that day. Burns after that day are not added back, a difference of less than 0.02% of the supply. The rebuilt supply starts at 2022-10-18, the Banff upgrade, as P-Chain blocks before it carry no time. The Data API counts the circulating supply as equal to the total supply.",
    );
    expect(sources[1].text).toBe("The stake from 2026-08-13 to 2026-08-25 comes from the P-Chain's validator sets (platform.getValidatorsAt at each day's last block), because no validator snapshots exist for those days. Where both exist, the two are equal to the nAVAX.");
  });

  it('start at Banff when the query states no window or one before it, and bound the burns by all of them', async () => {
    // P-Chain blocks before Banff carry no time: 534,442 reward outputs before 2022-10-18 16:00 have block_time 0
    const all = await (await fresh()).withSources('SELECT t, total_supply_avax FROM p_avax_supply_daily WHERE chain_id = 1 ORDER BY t', 1);
    expect(all.sql).toContain("block_time >= toDateTime('2022-10-18 00:00:00', 'UTC')");
    expect(all.sql).toContain("WITH FILL FROM toDate('2022-10-18')");
    const old = await (await fresh()).withSources("SELECT t, total_supply_avax FROM p_avax_supply_daily WHERE chain_id = 1 AND t >= toDate('2021-01-01') ORDER BY t", 1);
    expect(old.sql).toContain("block_time >= toDateTime('2022-10-18 00:00:00', 'UTC')");
    // every chain's burns, 5,173,216.84 AVAX of 468,647,013.18
    expect(old.sources[0].text).toContain('a difference of at most 1.1% of the supply on the first days, as every chain has burned 5.2M AVAX in all');
  });
});

// a writer that hands render_chart the same answer on every step (query-scope.test.ts)
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

describe('the answer to the question', () => {
  const ROWS = {
    columns: [
      { name: 't', type: 'Date' },
      { name: 'staked_avax', type: 'Nullable(Float64)' },
      { name: 'circulating_avax', type: 'Float64' },
      { name: 'staked_pct', type: 'Nullable(Float64)' },
    ],
    // the dev server's rows on 2026-10-16 for the first day, the day before Helicon, its day, the low and the last whole day
    rows: [
      { t: '2026-08-23', staked_avax: 217288397.18, circulating_avax: 466548632.38, staked_pct: 46.57 },
      { t: '2026-09-21', staked_avax: 203964435.24, circulating_avax: 467849960.45, staked_pct: 43.6 },
      { t: '2026-09-22', staked_avax: 205556463.38, circulating_avax: 467859692.66, staked_pct: 43.94 },
      { t: '2026-10-08', staked_avax: 183140496.49, circulating_avax: 468500282.69, staked_pct: 39.09 },
      { t: '2026-10-15', staked_avax: 205674537.2, circulating_avax: 468585107.36, staked_pct: 43.89 },
    ],
    rowCount: 5,
    elapsedMs: 1,
    rowsRead: 1,
    truncated: false,
  };
  const FINAL = {
    title: 'Staked share around Helicon upgrade',
    note: 'Daily Primary Network stake as a share of the circulating supply, from 30 days before Helicon (activated 2026-09-22) to now. The current day is not over.',
    sql: SHARE,
    chart: { kind: 'line', x: 't', series: [{ column: 'staked_pct', label: 'Staked share', unit: '%' }] },
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(generateText).mockReset();
    runQuery.mockReset().mockResolvedValue(ROWS);
    results.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("passes every check render_chart makes on the first try: the guard, the written-out date and the window's words", async () => {
    vi.mocked(generateText).mockImplementation(writes(FINAL));
    const answer = await answerQuestion({ chainId: 1, chainName: 'P-Chain', symbol: 'AVAX', prompt: QUESTION, history: [], baseUrl: 'http://localhost:3000', emit: () => {} });
    expect(results[0]).toEqual({ ok: true, rows: 5 });
    expect(results).toHaveLength(1);
    expect(runQuery).toHaveBeenCalledOnce();
    expect(answer).toMatchObject({ title: FINAL.title, chart: { kind: 'line' } });
    expect(answer?.sql).toContain('FROM p_avax_supply_daily AS s');
  });
});
