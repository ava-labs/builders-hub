import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gapNotes, PCHAIN_GAPS, STAKE_FILL } from '@/lib/explorer-query/gaps';
import { pchainPrompt } from '@/lib/explorer-query/prompt';

/* The days the mainnet P-Chain snapshots miss: no validator, delegator or L1 validator snapshots, and no P-Chain
   supply records, from 2026-08-13 to 08-26, while the stats database moved hosts. A daily stake answer showed a band
   of empty days there. */

const NOW = Date.parse('2026-10-16T15:00:00Z');
const PRIMARY = "unhex(repeat('00', 32))";
const STAKE = `WITH snaps AS (SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = 1 AND subnet_id = ${PRIMARY} AND snapshot_time >= toDate(now()) - INTERVAL 90 DAY AND snapshot_time <= now() - INTERVAL 15 MINUTE GROUP BY snapshot_time) SELECT toDate(snapshot_time) AS t, toNullable(argMax(staked, snapshot_time)) AS staked_avax FROM snaps GROUP BY t ORDER BY t`;
/** the same stake with the filled days added, as the worked example writes it */
const FILLED = STAKE.replace('GROUP BY snapshot_time)', 'GROUP BY snapshot_time UNION ALL SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1 AND snapshot_time >= toDate(now()) - INTERVAL 90 DAY)');
const DELEGATORS = 'SELECT toDate(snapshot_time) AS t, uniqExact(delegator_tx_id) AS delegations FROM p_delegator_snapshots WHERE chain_id = 1 AND snapshot_time >= toDate(now()) - INTERVAL 90 DAY GROUP BY t';

describe('the days the snapshots miss', () => {
  it('are one stake per day from 2026-08-13 to 2026-08-25, each at its last block', () => {
    expect(STAKE_FILL.map((r) => r.at.slice(0, 10))).toEqual(Array.from({ length: 13 }, (_, i) => new Date(Date.UTC(2026, 7, 13 + i)).toISOString().slice(0, 10)));
    for (const r of STAKE_FILL) expect(r.at.slice(11) >= '23:50:00', r.at).toBe(true);
    // the heights rise with the days, and each stake is a whole number of nAVAX
    expect(STAKE_FILL.map((r) => r.height)).toEqual([...STAKE_FILL.map((r) => r.height)].sort((a, b) => a - b));
    for (const r of STAKE_FILL) expect(r.weight).toMatch(/^\d{18}$/);
    // the fill starts after the last snapshot and ends before the first one after the gap
    const [snaps] = PCHAIN_GAPS;
    expect(Date.parse(`${STAKE_FILL[0].at}Z`.replace(' ', 'T'))).toBeGreaterThan(snaps.from);
    expect(Date.parse(`${STAKE_FILL.at(-1)!.at}Z`.replace(' ', 'T'))).toBeLessThan(snaps.to);
  });

  it('are named on the page when a query reads a table that misses them over a window that holds them', () => {
    expect(gapNotes(DELEGATORS, 1, NOW).map((n) => n.text)).toEqual(['No delegator snapshots exist from 2026-08-13 11:20 to 2026-08-26 12:03 UTC. The indexer stopped while the stats database moved hosts, so those days are empty.']);
    // a gap note is no source of ours, so the Source fact does not list it
    expect(gapNotes(DELEGATORS, 1, NOW)[0].label).toBe('');
    expect(gapNotes(STAKE, 1, NOW).map((n) => n.text)).toEqual(['No validator snapshots exist from 2026-08-13 11:20 to 2026-08-26 12:03 UTC. The indexer stopped while the stats database moved hosts, so those days are empty.']);
    // the P-Chain supply series misses the same days, from its own instants
    expect(gapNotes("SELECT toDate(block_time) AS t, argMax(supply, block_height) AS s FROM p_exec_state_history WHERE chain_id = 1 AND block_time >= toDateTime('2026-08-01 00:00:00') GROUP BY t", 1, NOW)[0].text).toContain('No P-Chain supply records exist from 2026-08-13 11:22 to 2026-08-26 12:03 UTC');
  });

  it('are not named when the stake is filled, the window misses them, or the chain is not the mainnet P-Chain', () => {
    expect(gapNotes(FILLED, 1, NOW)).toEqual([]);
    expect(gapNotes(DELEGATORS.replace('toDate(now()) - INTERVAL 90 DAY', 'toStartOfMonth(now())'), 1, NOW)).toEqual([]);
    expect(gapNotes(DELEGATORS.replace(/chain_id = 1/g, 'chain_id = 5'), 5, NOW)).toEqual([]);
    // one snapshot's time is no range: no line for days the query does not read
    expect(gapNotes("SELECT sum(weight) FROM p_validator_snapshots WHERE chain_id = 1 AND snapshot_time = toDateTime64('2026-10-08 23:53:55.620', 3, 'UTC')", 1, NOW)).toEqual([]);
    // nor a whole history with no bound, whose days the SQL does not state
    expect(gapNotes('SELECT toDate(block_time) AS t, argMax(supply, block_height) AS s FROM p_exec_state_history WHERE chain_id = 1 GROUP BY t', 1, NOW)).toEqual([]);
  });
});

describe('the mainnet P-Chain prompt', () => {
  it('says which days the snapshots miss, and adds the filled stake to the daily stake example', () => {
    const main = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
    expect(main).toContain('- Missing days: p_validator_snapshots, p_delegator_snapshots and p_l1_validator_snapshots have no rows from 2026-08-13 11:20 to 2026-08-26 12:03 UTC');
    expect(main).toContain('GROUP BY snapshot_time UNION ALL SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1 AND snapshot_time >= toDate(now()) - INTERVAL 30 DAY)');
  });

  it("leaves Fuji's as it was", () => {
    const fuji = pchainPrompt({ chainId: 5, network: 'fuji', schema: '', coverage: null, lines: null });
    for (const t of ['p_stake_fill', 'Missing days']) expect(fuji, t).not.toContain(t);
  });
});

describe('the filled stake our server sends', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is one row per filled day, with no read of its own', async () => {
    const { withSources } = await import('@/lib/explorer-query/sources');
    const fill = await withSources('SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1', 1);
    expect(fill.sql).toContain("('2026-08-13 23:57:21',25359462,601,213408752028754418)");
    expect(fill.sql.match(/\('2026-08-\d{2} \d{2}:\d{2}:\d{2}',\d+,\d+,\d+\)/g)).toHaveLength(13);
    expect(fill.sources.map((s) => s.text)).toEqual(["The stake from 2026-08-13 to 2026-08-25 comes from the P-Chain's validator sets (platform.getValidatorsAt at each day's last block), because no validator snapshots exist for those days. Where both exist, the two are equal to the nAVAX."]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
