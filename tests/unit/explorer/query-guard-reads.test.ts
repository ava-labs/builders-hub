import { describe, expect, it } from 'vitest';

import { guardSql } from '@/lib/explorer-query/guard';

/* Every name a query reads a table by is checked, and the server defines each table it may read as the page's chain's
   rows (sources.ts). Each refused query below passed the guard before 2026-10-07; default.raw_logs read 46,546 rows
   of every chain over 10 minutes where the page's chain held 7,660. */

const W = 'block_time >= now() - INTERVAL 1 DAY';
const error = (sql: string, chainId = 43114) => {
  const g = guardSql(sql, chainId);
  return g.ok ? '' : g.error;
};

describe('a table read past the FROM and JOIN names', () => {
  it('is refused after a comma when it is not a table here, and bounded like any table when it is', () => {
    expect(error(`SELECT count() AS n FROM raw_blocks AS b, evm_txs AS e WHERE b.chain_id = 43114 AND b.${W}`)).toBe('table evm_txs is not readable here; use raw_blocks, raw_txs, raw_logs, raw_traces, dex_factories, dex_tokens, lending_markets, lending_tokens');
    expect(error(`SELECT count() AS n FROM raw_blocks AS b, raw_traces AS r WHERE b.chain_id = 43114 AND b.number = r.block_number`)).toMatch(/^bound raw_traces on block_time or block_number/);
    expect(error(`SELECT count() AS n FROM raw_blocks AS b, default.raw_traces AS r WHERE b.chain_id = 43114 AND b.${W}`)).toBe('write raw_traces without a database name');
  });

  it('is refused in parentheses that hold no SELECT, and on the right of an IN', () => {
    expect(error(`SELECT count() AS n FROM (raw_txs) WHERE chain_id = 43114 AND ${W}`)).toMatch(/^FROM \( holds a subquery/);
    expect(error(`SELECT count() AS n FROM raw_txs AS t JOIN (raw_logs) AS l ON l.transaction_hash = t.hash WHERE t.chain_id = 43114 AND t.${W}`)).toMatch(/^JOIN \( holds a subquery/);
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND hash IN evm_txs`)).toMatch(/^IN evm_txs reads a table by its name/);
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND hash NOT IN default.raw_logs`)).toMatch(/^IN default\.raw_logs reads a table by its name/);
  });

  it('is refused through a dictionary or a Join table, and through a database name', () => {
    expect(error(`SELECT dictGet('chains', 'name', chain_id) AS name FROM raw_blocks WHERE chain_id = 43114 AND ${W}`)).toBe("dictGet() reads a table by its name, which Query does not allow");
    expect(error(`SELECT joinGet('names', 'n', 1) AS n FROM raw_blocks WHERE chain_id = 43114 AND ${W}`)).toBe("joinGet() reads a table by its name, which Query does not allow");
    expect(error(`SELECT count() AS n FROM default.raw_logs WHERE chain_id = 43114 AND ${W}`)).toBe('write raw_logs without a database name');
  });

  it('is refused under a WITH that takes a table\'s name, which would stand for the table', () => {
    expect(error(`WITH raw_logs AS (SELECT * FROM raw_txs WHERE chain_id = 43114 AND ${W}) SELECT count() AS n FROM raw_logs`)).toBe('raw_logs is a table here; give the WITH another name');
    expect(error(`WITH p_validator_snapshots AS (SELECT 1 AS x) SELECT count() AS n FROM decoded_p_txs WHERE chain_id = 1 AND ${W}`, 1)).toBe('p_validator_snapshots is a table here; give the WITH another name');
  });
});

describe('a query that reads tables only by their names', () => {
  it('passes a comma between its own WITHs, or before a subquery', () => {
    const tot = `tot AS (SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W})`;
    const top = `top AS (SELECT count() AS m FROM raw_logs WHERE chain_id = 43114 AND ${W})`;
    expect(error(`WITH ${tot}, ${top} SELECT n, m FROM tot, top`)).toBe('');
    expect(error(`WITH ${tot} SELECT n, k FROM tot, (SELECT count() AS k FROM raw_blocks WHERE chain_id = 43114 AND ${W}) AS b`)).toBe('');
    expect(error(`WITH ${tot} SELECT count() AS c FROM raw_txs WHERE chain_id = 43114 AND ${W} AND hash IN tot`)).toBe('');
  });

  it("passes the commas of an ARRAY JOIN's list, an array's brackets, a USING list, and a list of values", () => {
    expect(error(`SELECT k, count() AS n FROM raw_logs ARRAY JOIN [topic1, topic2] AS k, [1, 2] AS i WHERE chain_id = 43114 AND ${W} GROUP BY k`)).toBe('');
    expect(error(`SELECT count() AS n FROM raw_logs LEFT ARRAY JOIN [topic1, topic2] AS k WHERE chain_id = 43114 AND ${W}`)).toBe('');
    expect(error(`SELECT count() AS n FROM (SELECT block_number, chain_id FROM raw_blocks WHERE chain_id = 43114 AND ${W}) AS a INNER JOIN (SELECT block_number, chain_id FROM raw_txs WHERE chain_id = 43114 AND ${W}) AS b USING block_number, chain_id`)).toBe('');
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND toHour(block_time) IN (1, 2) ORDER BY n, n LIMIT 1, 5`)).toBe('');
  });
});
