import { describe, expect, it } from 'vitest';

import { guardSql } from '@/lib/explorer-query/guard';

const DAY = 'FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY';
const sqlOf = (select: string, chainId = 43114) => {
  const g = guardSql(`SELECT ${select} ${chainId === 43114 ? DAY : DAY.replace('43114', String(chainId))}`, chainId);
  if (!g.ok) throw new Error(g.error);
  return g.sql;
};

describe('a median is exact', () => {
  it('reads quantile, quantiles and median as their exact functions', () => {
    const sql = sqlOf('quantile(0.5)(gas_price) AS m, quantiles(0.1, 0.9)(gas_price) AS q, median(gas_used) AS g');
    expect(sql).toContain('quantileExact(0.5)(gas_price) AS m');
    expect(sql).toContain('quantilesExact(0.1, 0.9)(gas_price) AS q');
    expect(sql).toContain('medianExact(gas_used) AS g');
    expect(sql).not.toMatch(/\b(quantiles?|median)\(/);
  });

  it('keeps the If combinator', () => {
    const sql = sqlOf('quantileIf(0.5)(gas_price, status = 0) AS m, medianIf(gas_used, status = 1) AS g');
    expect(sql).toContain('quantileExactIf(0.5)(gas_price, status = 0)');
    expect(sql).toContain('medianExactIf(gas_used, status = 1)');
  });

  it('leaves an exact or a chosen estimate alone, and a column named for a median', () => {
    const select = 'quantileExact(0.5)(gas_price) AS median_gas, quantileTDigest(0.99)(gas_price) AS p99, count() AS txs';
    expect(sqlOf(select)).toContain(select);
  });

  it('keeps Fuji as it was', () => {
    expect(sqlOf('quantile(0.5)(gas_price) AS m', 43113)).toContain('quantile(0.5)(gas_price) AS m');
  });
});
