import { describe, expect, it } from 'vitest';

import { runningL1Count, type RegistrySubnet } from '@/lib/pchain-subnets';

/* Mainnet on 2026-09-27: getAllValidatorsAt ran 69 sets, the Primary
   Network's and 68 subnets', and /api/l1-registry listed all 68 as active.
   Two are legacy subnets, not L1s, so /api/validator-stats counts 66. */
const PRIMARY = '11111111111111111111111111111111LpoYY';
const GUNZ = '2MbQjnTg3yxEtZBfnamboi7K9AajwNq7WExiwReBQSBtwbBVer';
const STEP_NETWORK = '7f9jciLEX25NPJEaAz1X7XF44B1Q9UBwq6PdnCHm5mnUq1e1C';

const l1 = (subnetId: string): RegistrySubnet => ({ subnetId, isL1: true });

describe('runningL1Count', () => {
  it('counts the running L1s, not the legacy subnets or the Primary Network that run sets too', () => {
    const counts = new Map([
      [PRIMARY, 605],
      [GUNZ, 11],
      [STEP_NETWORK, 1],
      ['l1-a', 5],
      ['l1-b', 1],
    ]);
    const subnets = [{ subnetId: PRIMARY }, { subnetId: GUNZ, isL1: false }, { subnetId: STEP_NETWORK, isL1: false }, l1('l1-a'), l1('l1-b')];
    expect(runningL1Count(counts, subnets)).toBe(2);
  });

  it('leaves out an L1 whose set is empty, and one the P-Chain did not list', () => {
    const counts = new Map([
      ['l1-a', 3],
      ['l1-drained', 0],
    ]);
    expect(runningL1Count(counts, [l1('l1-a'), l1('l1-drained'), l1('l1-unlisted')])).toBe(1);
  });
});
