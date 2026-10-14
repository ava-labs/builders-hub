import { describe, expect, it } from 'vitest';
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionZeroDataError,
  ExecutionRevertedError,
  HttpRequestError,
  getAddress,
  type PublicClient,
} from 'viem';

import {
  proxyAdminSubnetId,
  savedProxyAdminFor,
  savedProxyAdminProblem,
} from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/savedProxyAdmin';

const PRIMARY = '11111111111111111111111111111111LpoYY';
const L1_SUBNET = '2W9boARgCWL25z6pMFNtkCfNA5v28VGg9PmBgUJfuKndEdhrvw';
const FLOW_SUBNET = 'GsrsVSBpURJt7gpyGCX2SWxw3LDsVWqZQi1fprPuYNH1YrkYH';

const WALLET = '0x1111111111111111111111111111111111111111';
const ADMIN = '0x2222222222222222222222222222222222222222';
const OTHER_OWNER = '0x3333333333333333333333333333333333333333';
const EMPTY = '0x4444444444444444444444444444444444444444';
const NOT_ADMIN = '0x5555555555555555555555555555555555555555';
const NO_DATA = '0x6666666666666666666666666666666666666666';
const FOREIGN_ADMIN = '0x7777777777777777777777777777777777777777';

const ownerCall = (cause: BaseError) => new ContractFunctionExecutionError(cause, { abi: [], functionName: 'owner' });

// One chain: a ProxyAdmin the wallet owns, one another wallet owns, a contract
// with no owner(), one that returns no data, and an address with no code.
const chain = {
  getCode: async ({ address }: { address: string }) => (address === EMPTY ? undefined : '0x6080'),
  readContract: async ({ address }: { address: string }) => {
    if (address === ADMIN) return getAddress(WALLET);
    if (address === FOREIGN_ADMIN) return getAddress(OTHER_OWNER);
    if (address === NOT_ADMIN) throw ownerCall(new ExecutionRevertedError({}));
    if (address === NO_DATA) throw ownerCall(new ContractFunctionZeroDataError({ functionName: 'owner' }));
    throw new Error(`unexpected read of ${address}`);
  },
} as unknown as PublicClient;

describe('proxyAdminSubnetId', () => {
  it('takes the L1 of the wallet', () => {
    expect(proxyAdminSubnetId(L1_SUBNET, FLOW_SUBNET)).toBe(L1_SUBNET);
  });

  it('takes the subnet of the create flow on the C-Chain or with no L1', () => {
    expect(proxyAdminSubnetId(PRIMARY, FLOW_SUBNET)).toBe(FLOW_SUBNET);
    expect(proxyAdminSubnetId(undefined, FLOW_SUBNET)).toBe(FLOW_SUBNET);
    expect(proxyAdminSubnetId(PRIMARY, '')).toBe('');
  });
});

describe('savedProxyAdminFor', () => {
  const saved = { address: ADMIN, evmChainId: 43113, subnetId: FLOW_SUBNET };

  it('returns the address on the same chain for the same L1', () => {
    expect(savedProxyAdminFor(saved, 43113, FLOW_SUBNET)).toBe(ADMIN);
  });

  it('returns null on another chain, for another L1, with no chain, or with nothing saved', () => {
    expect(savedProxyAdminFor(saved, 43114, FLOW_SUBNET)).toBeNull();
    expect(savedProxyAdminFor(saved, 43113, L1_SUBNET)).toBeNull();
    expect(savedProxyAdminFor(saved, 43113, '')).toBeNull();
    expect(savedProxyAdminFor(saved, 0, FLOW_SUBNET)).toBeNull();
    expect(savedProxyAdminFor(null, 43113, FLOW_SUBNET)).toBeNull();
    expect(savedProxyAdminFor(undefined, 43113, FLOW_SUBNET)).toBeNull();
  });
});

describe('savedProxyAdminProblem', () => {
  it('accepts a ProxyAdmin that the connected wallet owns, in any letter case', async () => {
    expect(await savedProxyAdminProblem(chain, ADMIN, WALLET)).toBeNull();
    expect(await savedProxyAdminProblem(chain, ADMIN, getAddress(WALLET))).toBeNull();
  });

  it('refuses a ProxyAdmin that another wallet owns, names the owner, and keeps the saved address', async () => {
    expect(await savedProxyAdminProblem(chain, FOREIGN_ADMIN, WALLET)).toEqual({
      message:
        `This page deployed a ProxyAdmin earlier (${FOREIGN_ADMIN}). Its owner is ${getAddress(OTHER_OWNER)}, ` +
        'not the connected wallet. Connect that account, or deploy a new ProxyAdmin.',
      keepSaved: true,
    });
  });

  it('refuses an address with no code, and removes the saved address', async () => {
    expect(await savedProxyAdminProblem(chain, EMPTY, WALLET)).toEqual({
      message:
        `This page does not use the ProxyAdmin that it deployed earlier (${EMPTY}). ` +
        'No contract exists at this address on this chain. Deploy a new ProxyAdmin.',
      keepSaved: false,
    });
  });

  it('refuses a contract whose owner() reverts or returns no data, and removes the saved address', async () => {
    for (const address of [NOT_ADMIN, NO_DATA]) {
      const problem = await savedProxyAdminProblem(chain, address, WALLET);
      expect(problem?.message).toMatch(/is not a ProxyAdmin\. Deploy a new/);
      expect(problem?.keepSaved).toBe(false);
    }
  });

  it('refuses a saved value that is not an address, and removes it', async () => {
    const problem = await savedProxyAdminProblem(chain, '0x1234', WALLET);
    expect(problem?.message).toMatch(/The saved address is not valid\./);
    expect(problem?.keepSaved).toBe(false);
  });

  it('throws when the chain cannot be read, so the saved address stays', async () => {
    const down = {
      getCode: async () => {
        throw new HttpRequestError({ url: 'https://rpc.invalid' });
      },
    } as unknown as PublicClient;
    await expect(savedProxyAdminProblem(down, ADMIN, WALLET)).rejects.toThrow();

    const ownerDown = {
      getCode: async () => '0x6080',
      readContract: async () => {
        throw ownerCall(new HttpRequestError({ url: 'https://rpc.invalid' }));
      },
    } as unknown as PublicClient;
    await expect(savedProxyAdminProblem(ownerDown, ADMIN, WALLET)).rejects.toThrow();
  });
});
