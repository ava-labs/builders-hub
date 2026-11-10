import { describe, expect, it } from 'vitest';

import { feePercentAt } from '@/components/explorer-v2/pchain/node-data';
import type { NodeResponse, ValidationsResponse } from '@/lib/pchain-explorer';

/* Recent Staking Activity nets each delegation's reward of the fee its
   validator charged then: the current term's for a delegation in it, else
   the closed term it fell in. */

const n = { hasSnapshot: true, validator: { startTimestamp: 1_000, delegationFeePercent: 2 } } as NodeResponse;
const record = {
  periods: [
    { startTimestamp: 100, endTimestamp: 900, delegationFeePercent: 5 },
    { subnetId: 'L1', startTimestamp: 100, endTimestamp: 900, delegationFeePercent: 9 },
  ],
} as ValidationsResponse;

describe("a delegation's fee", () => {
  it("is the current term's for a delegation that began in it", () => {
    expect(feePercentAt(n, record, 1_500)).toBe(2);
  });

  it("is a closed Primary Network term's for an older delegation", () => {
    expect(feePercentAt(n, record, 500)).toBe(5);
  });

  it('is unknown when no term on record covers it', () => {
    expect(feePercentAt(n, record, 950)).toBeUndefined();
    expect(feePercentAt(n, null, 500)).toBeUndefined();
    expect(feePercentAt({ ...n, hasSnapshot: false }, null, 1_500)).toBeUndefined();
  });
});
