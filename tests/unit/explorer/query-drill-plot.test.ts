import { describe, expect, it } from 'vitest';

import { bucketOf, drillCut } from '@/components/explorer-v2/evm/drill-plot';

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
  it('names the records a LIMIT cut', () => {
    const sql = (order: string, n = 50) => `SELECT tx_hash, fee_avax FROM raw_txs WHERE chain_id = 43114 AND toDate(block_time) = '2026-09-24' ORDER BY ${order}\nLIMIT ${n}`;
    expect(drillCut(sql('fee_avax DESC'), 50)).toBe('the 50 largest fees');
    expect(drillCut(sql('fee_gun ASC'), 50)).toBe('the 50 smallest fees');
    expect(drillCut(sql('gas_charged DESC'), 50)).toBe('the 50 largest by gas charged');
    expect(drillCut(sql('block_time DESC'), 50)).toBe('the 50 latest');
    expect(drillCut(sql('t'), 50)).toBe('the 50 earliest');
  });

  it('names nothing for records that are all there are', () => {
    expect(drillCut('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114 ORDER BY fee_avax DESC LIMIT 50', 12)).toBeNull();
    expect(drillCut('SELECT tx_hash FROM raw_txs WHERE chain_id = 43114', 50)).toBeNull();
    // a LIMIT inside a subquery is not the records' own
    expect(drillCut('SELECT * FROM (SELECT tx_hash FROM raw_txs ORDER BY fee_avax DESC LIMIT 50) WHERE 1', 50)).toBeNull();
  });
});
