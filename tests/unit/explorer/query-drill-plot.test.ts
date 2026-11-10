import { describe, expect, it } from 'vitest';

import { bucketOf } from '@/components/explorer-v2/evm/drill-plot';
import { binStep, drillCut, drillWhole, profileSql } from '@/lib/explorer-query/drill-profile';

const DAY = 86_400;

describe('bucketOf', () => {
  it("spans a mark's bucket to the series' next step", () => {
    const days = [{ t: '2026-09-23' }, { t: '2026-09-24' }, { t: '2026-09-25' }];
    const at = Date.parse('2026-09-24T00:00:00Z') / 1000;
    expect(bucketOf('2026-09-24', 't', days)).toEqual([at, at + DAY]);
    const five = [{ t: '2026-09-28 10:00:00' }, { t: '2026-09-28 10:05:00' }];
    const ten = Date.parse('2026-09-28T10:05:00Z') / 1000;
    expect(bucketOf('2026-09-28 10:05:00', 't', five)).toEqual([ten, ten + 300]);
  });

  it('gives no bucket for a mark that is no time, or a series of one', () => {
    expect(bucketOf('0xabc', 'contract', [{ contract: '0xabc' }, { contract: '0xdef' }])).toBeNull();
    expect(bucketOf('2026-09-24', 't', [{ t: '2026-09-24' }])).toBeNull();
    expect(bucketOf('2026-09-24', undefined, [{ t: '2026-09-23' }, { t: '2026-09-24' }])).toBeNull();
  });
});

describe('drillCut', () => {
  it('names the records a LIMIT cut, and tells a run of time from the top of a figure', () => {
    const sql = (order: string, n = 50) => `SELECT tx_hash, fee_avax FROM raw_txs WHERE chain_id = 43114 AND toDate(block_time) = '2026-09-24' ORDER BY ${order}\nLIMIT ${n}`;
    expect(drillCut(sql('fee_avax DESC'), 50)).toEqual({ words: 'the 50 largest fees', col: 'fee_avax', byTime: false });
    expect(drillCut(sql('fee_gun ASC'), 50)).toEqual({ words: 'the 50 smallest fees', col: 'fee_gun', byTime: false });
    expect(drillCut(sql('gas_charged DESC'), 50)).toEqual({ words: 'the 50 largest by gas charged', col: 'gas_charged', byTime: false });
    expect(drillCut(sql('amount_usdc DESC'), 50)).toEqual({ words: 'the 50 largest amounts', col: 'amount_usdc', byTime: false });
    // the 50 latest of a busy 5 minutes are its last seconds: they plot across those seconds, not the bucket
    expect(drillCut(sql('block_time DESC'), 50)).toEqual({ words: 'the 50 latest', col: 'block_time', byTime: true });
    expect(drillCut(sql('t'), 50)).toEqual({ words: 'the 50 earliest', col: 't', byTime: true });
  });

  it('names nothing for records that are all there are', () => {
    expect(drillCut('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114 ORDER BY fee_avax DESC LIMIT 50', 12)).toBeNull();
    expect(drillCut('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114', 50)).toBeNull();
    // a LIMIT inside a subquery is not the records' own
    expect(drillCut('SELECT * FROM (SELECT tx_hash FROM raw_txs ORDER BY fee_avax DESC LIMIT 50) WHERE 1', 50)).toBeNull();
  });
});

describe('drillWhole', () => {
  it('tells records that are all there are from a page the LIMIT cut', () => {
    expect(drillWhole('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114 ORDER BY fee_avax DESC\nLIMIT 50', 37)).toBe(true);
    expect(drillWhole('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114', 37)).toBe(true);
    // the guard ends every query with a LIMIT: a drill that fills it may have more
    expect(drillWhole('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114\nLIMIT 100', 100)).toBe(false);
    // a LIMIT inside cuts the population before the drill reads it
    expect(drillWhole('SELECT * FROM (SELECT tx_hash FROM raw_txs ORDER BY fee_avax DESC LIMIT 50) WHERE status = 0\nLIMIT 100', 12)).toBe(false);
  });
});

describe('profileSql', () => {
  const drill = (order: string) =>
    `SELECT block_time AS t, concat('0x', hex(hash)) AS tx_hash, toFloat64(gas_used) * gas_price / 1e18 AS fee_avax, gas_price FROM raw_txs WHERE chain_id = 43114 AND toDate(block_time) = '2026-09-24' ORDER BY ${order} LIMIT 50`;
  const day: [number, number] = [Date.parse('2026-09-24T00:00:00Z') / 1000, Date.parse('2026-09-25T00:00:00Z') / 1000];

  it("bins a ranked drill's whole population over its bucket: its SQL without the last ORDER BY and LIMIT", () => {
    const p = profileSql(drill('fee_avax DESC'), day)!;
    expect(p).toMatchObject({ col: 'fee_avax', agg: 'sum', step: 900 });
    expect(p.sql).toContain("toDate(block_time) = '2026-09-24'\n) GROUP BY bin ORDER BY bin");
    expect(p.sql).not.toMatch(/LIMIT 50/);
    expect(p.sql).toMatch(/^SELECT toUnixTimestamp\(toStartOfInterval\(t, INTERVAL 900 SECOND\)\) AS bin, count\(\) AS n, sum\(`fee_avax`\) AS v FROM \(/);
  });

  it('takes the highest of a figure that does not add up, and bins no run of time', () => {
    expect(profileSql(drill('gas_price DESC'), day)).toMatchObject({ col: 'gas_price', agg: 'max' });
    expect(profileSql(drill('t DESC'), day)).toBeNull();
    expect(profileSql(drill('fee_avax DESC'), [day[0], day[0]])).toBeNull();
    // an ORDER BY inside a subquery is not the drill's own
    expect(profileSql('SELECT * FROM (SELECT block_time AS t FROM raw_txs ORDER BY t DESC LIMIT 5)', day)).toBeNull();
  });

  it('gives a bucket at most 96 bins on a round step, and a bin 10 s at least', () => {
    expect([86_400, 3_600, 300, 60, 7 * 86_400].map(binStep)).toEqual([900, 60, 10, 10, 7200]);
  });
});

