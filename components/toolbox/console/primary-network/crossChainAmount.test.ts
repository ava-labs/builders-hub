import { describe, it, expect } from 'vitest';
import { avaxToNanoAvax } from '@avalanche-sdk/client/utils';

// Regression guard for the exportCross "The number X cannot be converted to a
// BigInt" crashes (DevRel weekly, Jun 01 2026). The old code returned an AVAX
// float (`Math.floor(avax * 1e9) / 1e9`) and then called `BigInt(safeAmount)`,
// which threw on any decimal and silently sent dust for whole numbers. We now
// delegate to the SDK's converter — the same one `Stake.tsx` uses — which is the
// exact unit (nAVAX) `prepareExportTxn` expects. This pins the production-failure
// inputs to their correct nAVAX values.
describe('cross-chain export amount → nAVAX', () => {
  it('converts the production-failure decimals without throwing', () => {
    expect(avaxToNanoAvax(0.5)).toBe(500_000_000n);
    expect(avaxToNanoAvax(0.499)).toBe(499_000_000n);
    expect(avaxToNanoAvax(1.498999999)).toBe(1_498_999_999n);
    expect(avaxToNanoAvax(1.499)).toBe(1_499_000_000n);
  });

  it('maps whole AVAX to full nAVAX (the old BigInt(safeAmount) path sent 2n dust)', () => {
    expect(avaxToNanoAvax(2)).toBe(2_000_000_000n);
  });

  it('handles the smallest unit and zero for the >0 export guard', () => {
    expect(avaxToNanoAvax(1e-9)).toBe(1n);
    expect(avaxToNanoAvax(0)).toBe(0n);
  });
});
