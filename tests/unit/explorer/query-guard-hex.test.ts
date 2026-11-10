import { describe, expect, it } from 'vitest';
import { guardSql } from '@/lib/explorer-query/guard';

// a 40-digit address, where a 64-digit topic or hash belongs
const ADDRESS = '655c406ebfa14ee2006250925e54ec43ad184f8b';
const WINDOW = 'chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR';

describe('a hex literal is held against the column it is compared with', () => {
  it('leaves an IN over a subquery to the comparisons inside it', () => {
    const sql = `SELECT count() AS n FROM raw_logs WHERE ${WINDOW} AND transaction_hash IN (SELECT transaction_hash FROM raw_logs WHERE ${WINDOW} AND address = unhex('${ADDRESS}'))`;
    expect(guardSql(sql, 43114).ok).toBe(true);
  });

  it('refuses a list literal whose length is not its column', () => {
    const g = guardSql(`SELECT count() AS n FROM raw_logs WHERE ${WINDOW} AND transaction_hash IN (unhex('${ADDRESS}'))`, 43114);
    expect(g.ok).toBe(false);
    expect(g.ok ? '' : g.error).toMatch(/40 hex digits, and transaction_hash holds 64/);
  });

  it('refuses a wrong length inside the subquery, against its own column', () => {
    const sql = `SELECT count() AS n FROM raw_logs WHERE ${WINDOW} AND transaction_hash IN (SELECT transaction_hash FROM raw_logs WHERE ${WINDOW} AND topic0 = unhex('${ADDRESS}'))`;
    const g = guardSql(sql, 43114);
    expect(g.ok).toBe(false);
    expect(g.ok ? '' : g.error).toMatch(/topic0 holds 64/);
  });
});
