import { describe, expect, it } from 'vitest';

import { guardSql } from '@/lib/explorer-query/guard';

// r7's E04, as the writer sent it: top10_share_pct read 98.32 on every row, the share of all 1,066 contracts, where
// the top 10 used 49.25% of the day's gas
const E04 = 'WITH tot AS (SELECT sum(toFloat64(gas_used)) AS total FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfDay(now())) SELECT lower(concat(\'0x\', hex(`to`))) AS address, sum(gas_used) AS gas_charged, count() AS txs, uniqExact(`from`) AS senders, sum(toFloat64(gas_used) * gas_price) / 1e18 AS fees_avax, round(100 * sum(toFloat64(gas_used)) / (SELECT total FROM tot), 2) AS share_pct, round(100 * sum(sum(toFloat64(gas_used))) OVER () / (SELECT total FROM tot), 2) AS top10_share_pct, count() OVER () AS of_total FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfDay(now()) AND `to` IS NOT NULL GROUP BY `to` HAVING countIf(length(input) >= 4) > 0 ORDER BY gas_charged DESC LIMIT 10';
const TOP = ', round(100 * sum(sum(toFloat64(gas_used))) OVER () / (SELECT total FROM tot), 2) AS top10_share_pct';

describe('a column named for the rows a LIMIT keeps', () => {
  it('is refused when a window over every group computes it', () => {
    const g = guardSql(E04, 43114);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.error).toMatch(/^top10_share_pct is a window over every group: OVER \(\) runs before the LIMIT/);
  });

  it("passes a share of all and a count of all groups, as their names say", () => {
    expect(guardSql(E04.replace(TOP, ''), 43114).ok).toBe(true);
  });

  it('passes a total over the limited rows, and a running total', () => {
    expect(guardSql('SELECT address, gas, sum(gas) OVER () AS top10_gas FROM (SELECT lower(concat(\'0x\', hex(`to`))) AS address, sum(gas_used) AS gas FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY GROUP BY `to` ORDER BY gas DESC LIMIT 10)', 43114).ok).toBe(true);
    expect(guardSql('SELECT `to`, sum(gas_used) AS gas, sum(sum(gas_used)) OVER (ORDER BY sum(gas_used) DESC) AS top_running FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY GROUP BY `to` ORDER BY gas DESC LIMIT 10', 43114).ok).toBe(true);
  });

  it('passes a first or a top-level figure over every group, which is not about the top rows', () => {
    const first = E04.replace(TOP, ', min(block_time) OVER () AS first_seen, sum(count()) OVER () AS top_level_txs');
    expect(guardSql(first, 43114).ok).toBe(true);
  });

  it('keeps Fuji as it was', () => {
    expect(guardSql(E04.replaceAll('43114', '43113'), 43113).ok).toBe(true);
  });
});
