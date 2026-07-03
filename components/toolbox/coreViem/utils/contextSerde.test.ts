import { describe, it, expect } from 'vitest';
import { stringifyContext, parseContext } from './contextSerde';

// Mirrors the real Context shape: bigints at the top level AND nested inside
// platformFeeConfig (maxCapacity, …), with `weights` as a numeric Record.
// Fixture values are arbitrary placeholders.
const sample = {
  networkID: 5,
  hrp: 'fuji',
  xBlockchainID: 'X_CHAIN_ID',
  pBlockchainID: 'P_CHAIN_ID',
  cBlockchainID: 'C_CHAIN_ID',
  avaxAssetID: 'AVAX_ASSET_ID',
  baseTxFee: 1_000_000n,
  createAssetTxFee: 10_000_000n,
  platformFeeConfig: {
    weights: { 0: 1, 1: 1000, 2: 1000, 3: 4 },
    maxCapacity: 1_000_000n,
    maxPerSecond: 100_000n,
    targetPerSecond: 50_000n,
    minPrice: 1n,
    excessConversionConstant: 2_164_043n,
  },
};

describe('contextSerde', () => {
  it('round-trips a Context, restoring top-level and nested bigints', () => {
    const revived = parseContext<typeof sample>(stringifyContext(sample));
    expect(revived).toEqual(sample);
    expect(typeof revived.baseTxFee).toBe('bigint');
    expect(typeof revived.platformFeeConfig.maxCapacity).toBe('bigint');
    expect(typeof revived.platformFeeConfig.minPrice).toBe('bigint');
  });

  it('keeps numeric weights as plain numbers', () => {
    const revived = parseContext<typeof sample>(stringifyContext(sample));
    expect(revived.platformFeeConfig.weights).toEqual({ 0: 1, 1: 1000, 2: 1000, 3: 4 });
  });

  it('produces valid JSON (no bigint serialization error)', () => {
    const json = stringifyContext(sample);
    expect(() => JSON.parse(json)).not.toThrow();
    // bigints are tagged, not raw
    expect(json).toContain('__avax_bigint__');
  });

  it('does not mutate the input', () => {
    const before = JSON.parse(stringifyContext(sample));
    stringifyContext(sample);
    expect(JSON.parse(stringifyContext(sample))).toEqual(before);
    expect(typeof sample.baseTxFee).toBe('bigint');
  });
});
