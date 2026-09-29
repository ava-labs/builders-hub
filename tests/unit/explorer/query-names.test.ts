import { toFunctionSelector } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verified = vi.hoisted(() => new Map<string, { name: string; abi: unknown[] }>());
vi.mock('@/lib/sourcify', () => ({
  getVerifiedContractResolvingProxies: vi.fn(async (_chainId: number, address: string) => {
    const v = verified.get(address);
    return v ? { match: 'match', name: v.name, compilerVersion: null, language: null, verifiedAt: null, abi: v.abi } : null;
  }),
}));

import { enrichNames } from '@/lib/explorer-query/enrich';

/** what the signature database holds, as /api/signatures answers */
const SIGNATURES: Record<string, { name: string; verified: boolean }> = {
  '0x00000000': { name: 'fulfillBasicOrder_efficient_6GL6yc((address,uint256))', verified: true },
  '0xa00597a0': { name: 'BrrrrrrrrrrrrrZ2826820544()', verified: true },
  '0x02dbe483': { name: 'get(address[],bytes[])', verified: false },
  '0xf1910f70': { name: 'swapExactIn(address,address,address,uint256,uint256,address,uint256,bytes)', verified: true },
  '0xab5898e8': { name: 'execute(bytes,uint256)', verified: true },
};
const addr = (c: string) => `0x${c.repeat(40)}`;
let asked: string[];

beforeEach(() => {
  asked = [];
  verified.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(String(url));
      if (u.pathname === '/api/signatures') {
        const fns = (u.searchParams.get('function') ?? '').split(',').filter(Boolean);
        asked.push(...fns);
        return Response.json({ function: Object.fromEntries(fns.map((s) => [s, SIGNATURES[s] ?? null])), event: {} });
      }
      return Response.json({ tokens: {} });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const columns = [
  { name: 'method_id', type: 'String' },
  { name: 'contract', type: 'Nullable(String)' },
  { name: 'txs', type: 'UInt64' },
];

describe('selector names', () => {
  it('names a selector from the registry, the called contract, or a verified, written name, and nothing else', async () => {
    // the called contract's verified code names 0x35faa416 (sweep()) and says 0xab5898e8 is not one of its functions
    verified.set(addr('b'), { name: 'Sweeper', abi: [{ type: 'function', name: 'sweep', inputs: [], outputs: [], stateMutability: 'nonpayable' }] });
    const rows = [
      { method_id: '0xa9059cbb', contract: addr('a'), txs: 9 },
      { method_id: '0x00000000', contract: addr('c'), txs: 8 },
      { method_id: '0xa00597a0', contract: addr('c'), txs: 7 },
      { method_id: '0x02dbe483', contract: addr('c'), txs: 6 },
      { method_id: '0xf1910f70', contract: addr('c'), txs: 5 },
      { method_id: '0x35faa416', contract: addr('b'), txs: 4 },
      { method_id: '0xab5898e8', contract: addr('b'), txs: 3 },
    ];
    const names = await enrichNames(43114, columns, rows, 'http://localhost:3000');
    expect(names.method_id).toEqual({ '0xa9059cbb': 'transfer', '0xf1910f70': 'swapExactIn', '0x35faa416': 'sweep' });
    expect(names.contract).toEqual({ [addr('b')]: 'Sweeper' });
    // mined selectors and the ones verified code denies are never looked up
    expect(asked.sort()).toEqual(['0x02dbe483', '0xa00597a0', '0xf1910f70']);
  });

  it("takes a mined-looking name from the called contract's verified code, with no lookup", async () => {
    const item = { type: 'function', name: 'swap_4Xq9Zz', inputs: [], outputs: [], stateMutability: 'nonpayable' } as const;
    const selector = toFunctionSelector(item);
    verified.set(addr('d'), { name: 'Router', abi: [item] });
    const names = await enrichNames(43114, columns, [{ method_id: selector, contract: addr('d'), txs: 1 }], 'http://localhost:3000');
    expect(names.method_id).toEqual({ [selector]: 'swap_4Xq9Zz' });
    expect(asked).toEqual([]);
  });
});

describe('the zero address in a column of tokens', () => {
  it('is AVAX on the C-Chain, and keeps its name in any other column or chain', async () => {
    // the audit's V09: Benqi keys its AVAX market by the zero address, and the market read "Null Address"
    const zero = addr('0');
    const cols = [{ name: 'token', type: 'String' }, { name: 'from_address', type: 'String' }, { name: 'borrows', type: 'UInt64' }];
    const rows = [{ token: zero, from_address: zero, borrows: 28 }];
    const names = await enrichNames(43114, cols, rows, 'http://localhost:3000');
    expect(names.token?.[zero]).toBe('AVAX');
    expect(names.from_address?.[zero]).toBe('Null Address');
    expect((await enrichNames(43419, cols, rows, 'http://localhost:3000')).token?.[zero]).toBe('Null Address');
  });
});
