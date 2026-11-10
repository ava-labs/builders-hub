import { describe, expect, it } from 'vitest';
import { getAddress, type PublicClient } from 'viem';

import {
  ADMIN_SLOT,
  IMPLEMENTATION_SLOT,
  implementationProblem,
} from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/proxyTarget';

const PROXY = '0xfacade0000000000000000000000000000000000';
const IMPL = '0x2222222222222222222222222222222222222222';
const OTHER_PROXY = '0x3333333333333333333333333333333333333333';
const EMPTY = '0x4444444444444444444444444444444444444444';
const word = (hex: string) => `0x${hex.replace(/^0x/, '').padStart(64, '0')}`;

// One chain: the genesis proxy, an implementation, a second proxy, and an address with no code.
const chain = {
  getCode: async ({ address }: { address: string }) => (address === EMPTY ? '0x' : '0x6080'),
  getStorageAt: async ({ address, slot }: { address: string; slot: string }) => {
    const isProxy = address === PROXY || address === OTHER_PROXY;
    if (!isProxy) return word('0');
    return slot === IMPLEMENTATION_SLOT ? word(IMPL) : slot === ADMIN_SLOT ? word('ab') : word('0');
  },
} as unknown as PublicClient;

describe('implementationProblem', () => {
  it('accepts a contract that is not a proxy', async () => {
    expect(await implementationProblem(chain, PROXY, IMPL)).toBeNull();
    expect(await implementationProblem(chain, '', IMPL)).toBeNull();
  });

  it('refuses the proxy itself, lowercase or checksummed', async () => {
    expect(await implementationProblem(chain, PROXY, PROXY)).toMatch(/proxy itself/);
    expect(await implementationProblem(chain, PROXY, getAddress(PROXY))).toMatch(/proxy itself/);
  });

  it('refuses another proxy, an address with no code, and a malformed address', async () => {
    expect(await implementationProblem(chain, PROXY, OTHER_PROXY)).toMatch(/is a proxy/);
    expect(await implementationProblem(chain, '', OTHER_PROXY)).toMatch(/is a proxy/);
    expect(await implementationProblem(chain, PROXY, EMPTY)).toMatch(/No contract/);
    expect(await implementationProblem(chain, PROXY, '0x1234')).toMatch(/valid contract address/);
  });
});
