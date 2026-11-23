import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardSql } from '@/lib/explorer-query/guard';
import { subnetsSql } from '@/lib/explorer-query/pchain-sets';
import { pchainPrompt } from '@/lib/explorer-query/prompt';
import { refSchema, SQL_BUDGET } from '@/lib/explorer-query/sources';

/* "Active subnets that have not converted to an L1" was read as every subnet with no ConvertSubnetToL1Tx, most of
   which run no validator. A subnet that has not converted has its validators in no snapshot table: they are the
   AddSubnetValidatorTx terms that have not ended. p_subnets holds each subnet as it stands now, so the question is
   one read: on 2026-11-10, Gunzilla with 6 validators and Step Network with 1, of 582 subnets. */

const ACTIVE_LEGACY = 'SELECT subnet_id, validators FROM p_subnets WHERE chain_id = 1 AND is_l1 = 0 AND validators > 0 ORDER BY validators DESC';
const prompt = (chainId: number) => pchainPrompt({ chainId, network: 'mainnet', schema: '', coverage: null, lines: null });
/** the worked example's SQL that starts with these words */
const example = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start)) ?? '';

describe('p_subnets, each subnet as it stands now', () => {
  it('is a mainnet table with one row per subnet: an L1 or not, and the validators in its set', () => {
    expect(refSchema(1).at(-1)).toBe("p_subnets(chain_id UInt8, subnet_id String, created_at DateTime('UTC'), chains UInt32, chain_name String, is_l1 UInt8, converted_at Nullable(DateTime('UTC')), validators UInt32, validators_until Nullable(DateTime('UTC')))");
    expect(guardSql(ACTIVE_LEGACY, 1).ok).toBe(true);
    // Fuji keeps its tables as they were
    expect(guardSql(ACTIVE_LEGACY.replace('= 1', '= 5'), 5).ok).toBe(false);
  });

  it('reads the transactions once, and each figure is one a row written twice does not change', () => {
    const sql = subnetsSql(1);
    expect(sql.match(/FROM decoded_p_txs\b/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\bFINAL\b/);
    // a CreateSubnetTx names its subnet by its own id
    expect(sql).toContain("if(tx_type = 'CreateSubnetTx', tx_id, assumeNotNull(subnet_id)) AS s");
    // a term holds its seat until it ends, unless a removal came after it
    expect(sql).toContain('countIf(ends > now() AND removed < added) AS n');
    // an L1's validators are its active seats in the newest complete snapshot
    expect(sql).toContain('FROM p_l1_validator_snapshots WHERE chain_id = 1 AND balance > 0 AND snapshot_time = (SELECT max(snap_t)');
    expect(sql).toContain('toUInt32(if(b.l1 = 1, l.n, b.n)) AS validators');
    // no count of transaction rows, which would count a row written twice as two: chains are distinct ids, and seats
    // are one per node
    const scan = sql.slice(sql.indexOf('SELECT if(tx_type'), sql.indexOf('GROUP BY s, node'));
    expect(scan).toContain("uniqExactIf(tx_id, tx_type = 'CreateChainTx') AS t_chains");
    expect(scan).not.toMatch(/\b(?:count|sum)\(/);
  });

  it('tells the mainnet writer what a legacy subnet is, and answers the question in one read', () => {
    const text = prompt(1);
    expect(text).toContain("a legacy subnet's validators are in no snapshot table");
    expect(text).not.toContain('Other subnet_id values are L1s');
    expect(text).toContain('active, live or running means validators > 0');
    const main = example(text, 'SELECT subnet_id, validators, toString(validators_until)');
    expect(main).toContain('FROM p_subnets WHERE chain_id = 1 AND is_l1 = 0 AND validators > 0');
    expect(guardSql(main, 1).ok).toBe(true);
    const states = example(text, 'SELECT multiIf(is_l1 = 1 AND validators > 0');
    expect(guardSql(states, 1).ok).toBe(true);
    // its sum has its own name: named validators, the multiIf would read the sum
    expect(states).toContain('sum(validators) AS validators_now');
    // the drill opens the terms that hold a seat now, on a bounded read of the transactions
    const drill = (text.split('\n').find((l) => l.startsWith('drill: ') && l.includes('AddSubnetValidatorTx')) ?? '').slice('drill: '.length);
    expect(drill).toContain("tx_type = 'AddSubnetValidatorTx' AND subnet_id = {{subnet_id:bytes}} AND end_time > now()");
    expect(guardSql(drill.replace('{{subnet_id:bytes}}', "unhex('00')"), 1).ok).toBe(true);
  });

  it('leaves the Fuji writer as it was', () => {
    const text = prompt(5);
    expect(text).toContain('Other subnet_id values are L1s.');
    for (const t of ['p_subnets', 'legacy subnet']) expect(text, t).not.toContain(t);
  });
});

describe('the subnets our server sends', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('are defined in front of the query from the box\'s own tables, with no read of a feed', async () => {
    const { withSources } = await import('@/lib/explorer-query/sources');
    const out = await withSources(ACTIVE_LEGACY, 1);
    expect(out.sql.startsWith(`WITH p_subnets AS (${subnetsSql(1)}) SELECT * FROM (`)).toBe(true);
    expect(Buffer.byteLength(out.sql)).toBeLessThan(SQL_BUDGET / 4);
    expect(out.sources).toEqual([expect.objectContaining({ table: 'p_subnets', label: 'subnets and their validators' })]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('read the chain\'s own transactions when the query names them too', async () => {
    const { withSources } = await import('@/lib/explorer-query/sources');
    const joined = `SELECT s.subnet_id, count() AS terms FROM p_subnets AS s INNER JOIN decoded_p_txs AS t ON base58Encode(concat(assumeNotNull(t.subnet_id), substring(SHA256(assumeNotNull(t.subnet_id)), 29, 4))) = s.subnet_id WHERE t.chain_id = 1 AND t.block_time >= now() - INTERVAL 366 DAY AND t.tx_type = 'AddSubnetValidatorTx' GROUP BY s.subnet_id`;
    const out = await withSources(joined, 1);
    // the chain's rows are defined first, so the table reads them through the same definition
    expect(out.sql.startsWith('WITH decoded_p_txs AS (SELECT * FROM decoded_p_txs FINAL WHERE chain_id = 1), p_subnets AS (')).toBe(true);
  });
});
