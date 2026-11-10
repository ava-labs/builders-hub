import { beforeEach, describe, expect, it, vi } from 'vitest';

const { frontendContext, fetchErc20Balances, readContract } = vi.hoisted(() => ({
  frontendContext: vi.fn(),
  fetchErc20Balances: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock('@/server/services/studio/frontend', () => ({ frontendContext }));
vi.mock('@/lib/rwa/glacier/client', () => ({ fetchErc20Balances }));
vi.mock('@/server/services/studio/chain', () => ({
  publicClient: () => ({ readContract }),
  rpcUrlOf: () => 'https://api.avax-test.network/ext/bc/C/rpc',
}));

import { tokenBalances, tokenList } from '@/server/services/studio/tokens';

const FUJI_USDC = '0x5425890298aed601595a70AB815c96711a31Bc65';
const PROJECT_TOKEN = '0x3333333333333333333333333333333333333333';
const OWNER = '0x4444444444444444444444444444444444444444';
const erc20 = ['balanceOf', 'transfer', 'decimals', 'symbol'].map((name) => ({
  type: 'function',
  name,
  inputs: [],
  outputs: [],
  stateMutability: 'view',
}));

beforeEach(() => {
  vi.clearAllMocks();
  frontendContext.mockResolvedValue({
    contracts: [
      { name: 'LaunchToken', address: PROJECT_TOKEN, chainId: 43113, network: 'fuji-c-chain', abi: erc20 },
      { name: 'Guestbook', address: OWNER, chainId: 43113, network: 'fuji-c-chain', abi: [] },
    ],
    chains: {},
    files: [],
  });
});

describe('tokenList', () => {
  it("merges the project's ERC-20s with the verified registry for the chain", async () => {
    const tokens = await tokenList('user-1', 'proj-1', 43113);
    expect(tokens[0]).toMatchObject({ address: PROJECT_TOKEN, name: 'LaunchToken', source: 'project' });
    expect(tokens.find((t) => t.symbol === 'USDC')).toMatchObject({
      address: FUJI_USDC,
      decimals: 6,
      source: 'registry',
    });
    expect(tokens.some((t) => t.name === 'Guestbook')).toBe(false);
  });
});

describe('tokenBalances', () => {
  it('uses the Data API when it covers every project token', async () => {
    fetchErc20Balances.mockResolvedValue({
      erc20TokenBalances: [
        { address: FUJI_USDC, balance: '2500000', decimals: 6, symbol: 'USDC' },
        { address: PROJECT_TOKEN, balance: '1000000000000000000', decimals: 18, symbol: 'MOON' },
        { address: '0x5555555555555555555555555555555555555555', balance: '0', decimals: 18 },
      ],
    });
    const result = await tokenBalances('user-1', 'proj-1', 43113, OWNER);
    expect(result.source).toBe('data-api');
    expect(result.balances.map((b) => [b.symbol, b.formatted])).toEqual([
      ['USDC', '2.5'],
      ['MOON', '1'],
    ]);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('falls back to balanceOf over the token list when the Data API has no answer', async () => {
    fetchErc20Balances.mockRejectedValue(new Error('unsupported chain'));
    readContract.mockImplementation(async ({ address, functionName }: { address: string; functionName: string }) => {
      if (functionName === 'balanceOf') return address === FUJI_USDC ? 1_000_000n : 0n;
      return functionName === 'decimals' ? 6 : 'USDC';
    });
    const result = await tokenBalances('user-1', 'proj-1', 43113, OWNER);
    expect(result.source).toBe('rpc');
    expect(result.balances).toEqual([expect.objectContaining({ address: FUJI_USDC, symbol: 'USDC', formatted: '1' })]);
  });

  it('refuses an owner that is not an address', async () => {
    await expect(tokenBalances('user-1', 'proj-1', 43113, 'not-an-address')).rejects.toThrow('EVM address');
  });
});
