import { describe, expect, it } from 'vitest';

import { pairNames } from '@/lib/explorer-query/enrich';
import type { Names } from '@/lib/explorer-query/types';

const col = (name: string) => ({ name, type: 'String' });
const WAVAX = '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7';
const USDC = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const BTCB = '0x152b9d0fdc40c096757f570a51e494bd4b943e50';

describe('a DEX pool', () => {
  const columns = ['pool_address', 'protocol', 'version', 'token0', 'token1', 'volume_usd'].map(col);
  const rows = [
    { pool_address: '0x8ac5707f8d4bde1d771d34c7afd81c3922b73379', protocol: 'pharaoh', version: 'DLMM', token0: WAVAX, token1: USDC, volume_usd: 1 },
    { pool_address: '0xf01449c0ba930b6e2caca3def3ccbd7a3e589534', protocol: 'pharaoh', version: 'V3', token0: WAVAX, token1: USDC, volume_usd: 1 },
    { pool_address: '0x5ca009013f6b898d134b6798b336a4592f3b4af2', protocol: 'pharaoh', version: 'V3', token0: BTCB, token1: WAVAX, volume_usd: 1 },
    { pool_address: '0xfae3f424a0a47706811521e3ee268f00cfb5c45e', protocol: 'uniswap', version: 'v3', token0: WAVAX, token1: USDC, volume_usd: 1 },
  ];

  it("reads as its protocol, version and pair where the rows carry its tokens, not its code's name (r11's G02)", () => {
    const names: Names = {
      protocol: { pharaoh: 'Pharaoh', uniswap: 'Uniswap' },
      pool_address: { '0x8ac5707f8d4bde1d771d34c7afd81c3922b73379': 'DLMMImmutableClone', '0xf01449c0ba930b6e2caca3def3ccbd7a3e589534': 'RamsesV3Pool' },
      token0: { [BTCB]: 'Bitcoin Bridge BTC.b Token' },
    };
    pairNames(columns, rows, names);
    expect(names.pool_address).toEqual({
      '0x8ac5707f8d4bde1d771d34c7afd81c3922b73379': 'Pharaoh DLMM WAVAX/USDC',
      '0xf01449c0ba930b6e2caca3def3ccbd7a3e589534': 'Pharaoh V3 WAVAX/USDC',
      '0x5ca009013f6b898d134b6798b336a4592f3b4af2': 'Pharaoh V3 BTC.b/WAVAX',
      '0xfae3f424a0a47706811521e3ee268f00cfb5c45e': 'Uniswap v3 WAVAX/USDC',
    });
  });

  it("leaves out a protocol every pool shares, as the title names it (r12's H02 clipped two to one bar name)", () => {
    const joe = [
      { pool_address: '0x864d4e5ee7318e97483db7eb0912e09f161516ea', protocol: 'trader-joe', version: 'LB v2.2', token0: WAVAX, token1: USDC, volume_usd: 1 },
      { pool_address: '0x4224f6f4c9280509724db2dbac314621e4465c29', protocol: 'trader-joe', version: 'LB v2.2', token0: WAVAX, token1: BTCB, volume_usd: 1 },
    ];
    const names: Names = { protocol: { 'trader-joe': 'Trader Joe' } };
    pairNames(columns, joe, names);
    expect(Object.values(names.pool_address)).toEqual(['LB v2.2 WAVAX/USDC', 'LB v2.2 WAVAX/BTC.b']);
    // one pool keeps its protocol
    const one: Names = { protocol: { 'trader-joe': 'Trader Joe' } };
    pairNames(columns, joe.slice(0, 1), one);
    expect(Object.values(one.pool_address)).toEqual(['Trader Joe LB v2.2 WAVAX/USDC']);
  });

  it('keeps a name that is a pair, tells two pools of one name apart, and names nothing without both tokens', () => {
    const twins = [rows[1], { ...rows[1], pool_address: '0xfae3f424a0a47706811521e3ee268f00cfb5c45e' }];
    const names: Names = { protocol: { pharaoh: 'Pharaoh' } };
    pairNames(columns, twins, names);
    expect(Object.values(names.pool_address)).toEqual(['V3 WAVAX/USDC 0xf014…9534', 'V3 WAVAX/USDC 0xfae3…c45e']);
    const kept: Names = { pool_address: { '0x8ac5707f8d4bde1d771d34c7afd81c3922b73379': 'LB WAVAX/USDC' } };
    pairNames(columns, rows.slice(0, 1), kept);
    expect(kept.pool_address['0x8ac5707f8d4bde1d771d34c7afd81c3922b73379']).toBe('LB WAVAX/USDC');
    // a WOOFi pool trades many pairs, so its tokens are NULL: it keeps the name it had
    const woo: Names = { pool_address: { '0x4c4af8dbc524681930a27b2f1af5bcc8062e6fb7': 'WooPPV2' } };
    pairNames(columns, [{ ...rows[0], pool_address: '0x4c4af8dbc524681930a27b2f1af5bcc8062e6fb7', token0: null, token1: null }], woo);
    expect(woo.pool_address['0x4c4af8dbc524681930a27b2f1af5bcc8062e6fb7']).toBe('WooPPV2');
    // a query with no pool column, or no token columns, names no pool
    const none: Names = {};
    pairNames(['router', 'token0', 'token1'].map(col), [{ router: '0x1', token0: WAVAX, token1: USDC }], none);
    pairNames(['pool'].map(col), [{ pool: '0x1' }], none);
    expect(none).toEqual({});
  });
});
