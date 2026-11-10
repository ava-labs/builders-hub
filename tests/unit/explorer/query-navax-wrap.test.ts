import { describe, expect, it } from 'vitest';
import { unitName } from '@/lib/explorer-query/checks';
import { pchainPrompt } from '@/lib/explorer-query/prompt';

/* A sum of nAVAX times a whole number. 2026-10-16 on the dev server, "share of primary network stake on each
   avalanchego version": 199.5M of 204.6M AVAX came back as a share of 7.37%, as 100 * sum(weight) passed UInt64's
   limit and wrapped with no error. */

const Q6 = 'SELECT version, sum(seats) AS validators, sum(weight) / 1e9 AS stake_avax, round(100 * sum(weight) / sum(sum(weight)) OVER (), 2) AS share_pct FROM p_validator_versions WHERE chain_id = 1 AND is_l1 = 0 GROUP BY version';

describe('a sum of nAVAX times a whole number', () => {
  it('is sent back on the P-Chain, with the form that does not wrap', () => {
    expect(unitName(Q6, 1)).toContain('100 * sum(weight) multiplies a sum of nAVAX as a whole number');
    expect(unitName(Q6, 1)).toContain('100 * (sum(weight) / 1e9), or 100 * toFloat64(sum(weight))');
    expect(unitName('SELECT sumIf(weight, is_l1 = 0) * 100 AS x FROM p_validator_versions WHERE chain_id = 1', 1)).toContain('multiplies a sum of nAVAX');
    // the multiply first still wraps: the division comes after it
    expect(unitName('SELECT 100 * sum(weight) / 1e9 AS x FROM p_validator_versions WHERE chain_id = 1', 1)).toContain('multiplies a sum of nAVAX');
  });

  it('passes when the sum is a decimal first, and on other chains', () => {
    for (const sql of [
      'SELECT round(100 * (sum(weight) / 1e9) / (sum(sum(weight)) OVER () / 1e9), 2) AS share_pct FROM p_validator_versions WHERE chain_id = 1',
      'SELECT 100 * toFloat64(sum(weight)) AS x FROM p_validator_versions WHERE chain_id = 1',
      'SELECT 100.0 * sum(weight) AS x FROM p_validator_versions WHERE chain_id = 1',
      "WITH snaps AS (SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = 1 AND snapshot_time >= now() - INTERVAL 30 DAY GROUP BY snapshot_time) SELECT toDate(snapshot_time) AS t, round(100 * argMax(staked, snapshot_time) / 468e6, 2) AS staked_pct FROM snaps GROUP BY t",
    ])
      expect(unitName(sql, 1), sql).toBeNull();
    // an EVM chain's amounts are other columns, and Fuji stays as it was
    expect(unitName(Q6.replace('chain_id = 1', 'chain_id = 5'), 5)).toBeNull();
  });

  it('is named in the mainnet P-Chain prompt, and not in Fuji', () => {
    expect(pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null })).toContain('make the sum a decimal before any multiply, 100 * (sum(weight) / 1e9)');
    expect(pchainPrompt({ chainId: 5, network: 'fuji', schema: '', coverage: null, lines: null })).not.toContain('make the sum a decimal');
  });
});
