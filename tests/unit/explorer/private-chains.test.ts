import { describe, expect, it } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import type { L1Chain } from '@/types/stats';
import { PRIVATE_IDS, isPrivateChain } from '@/components/explorer-v2/network/private';

const catalog = l1ChainsData as L1Chain[];

describe('private chains', () => {
  it('reads only a set flag as private', () => {
    expect(isPrivateChain({ isPrivate: true })).toBe(true);
    expect(isPrivateChain({ isPrivate: false })).toBe(false);
    expect(isPrivateChain({})).toBe(false);
    expect(isPrivateChain(undefined)).toBe(false);
  });

  // its operator calls it a private, permissioned L1
  it('keeps Lynq 01 private', () => {
    const lynq = catalog.find((c) => c.slug === 'lynq-01-17e4e0');
    expect(lynq && isPrivateChain(lynq)).toBe(true);
    expect(PRIVATE_IDS.has(String(lynq?.chainId))).toBe(true);
  });

  /* A private chain's blocks are not public. A listed RPC or an index
     says the flag or the entry is wrong: check the chain's own word. */
  it('lists no RPC and no index for a private chain', () => {
    for (const c of catalog.filter(isPrivateChain)) {
      expect(c.rpcUrl, c.chainName).toBeFalsy();
      expect(c.isIndexed, c.chainName).toBe(false);
    }
  });
});
