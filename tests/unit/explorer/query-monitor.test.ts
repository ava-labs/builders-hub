import { describe, expect, it } from 'vitest';

import { mayBeMonitor, minAmountOf, parseMonitor, type TokenMeta } from '@/lib/explorer-query/monitor';

/* Token contracts are the public C-Chain ones; the wallet is made up. */
const USDT = '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7';
const USDT_BRIDGED = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const USDC = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const PHAR = '0x13a466998ce03db73abc2d4df3bbd845ed1f28e7';
const PHAR_OLD = '0xaaab9d12a30504559b0c5a9a5977fee4a6081c6b';
const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

const tokens = new Map<string, TokenMeta>([
  [USDT, { symbol: 'USDT', name: 'Tether', decimals: 6 }],
  [USDT_BRIDGED, { symbol: 'USDT', name: 'Bridged Tether', decimals: 6 }],
  [USDC, { symbol: 'USDC', name: 'USDC', decimals: 6 }],
  [PHAR, { symbol: 'PHAR', name: 'Pharaoh', decimals: 18 }],
  [PHAR_OLD, { symbol: 'PHAR', name: 'Pharaoh [OLD]', decimals: 18 }],
]);
const C = { chainId: 43114, symbol: 'AVAX' };
const parse = (q: string) => parseMonitor(q, C, tokens);

describe('parseMonitor', () => {
  it('reads a token and its transfers, on the canonical contract of a shared symbol', () => {
    expect(parse('monitor usdt transfers')).toEqual({ chainId: 43114, kind: 'transfers', token: { address: USDT, symbol: 'USDT', decimals: 6 }, title: 'USDT transfers' });
    expect(parse('I want to monitor tether')?.token?.address).toBe(USDT);
    expect(parse('live USDC transfers')?.token?.address).toBe(USDC);
    expect(parse(`watch ${USDC.toUpperCase().replace('0X', '0x')}`)?.token?.address).toBe(USDC);
    // one list entry is marked old: the other is the token
    expect(parse('monitor PHAR transfers')?.token?.address).toBe(PHAR);
  });

  it('reads the smallest amount, and the chain coin as a native monitor', () => {
    expect(parse('watch USDC transfers over 10k')).toMatchObject({ minAmount: 10_000, title: 'USDC transfers over 10,000' });
    expect(parse('monitor avax transfers above 1,000')).toEqual({ chainId: 43114, kind: 'native', coin: 'AVAX', minAmount: 1000, title: 'AVAX transfers over 1,000' });
    expect(minAmountOf('over 1.5m')).toBe(1_500_000);
    expect(minAmountOf('> 250')).toBe(250);
    expect(minAmountOf('at least $2,500')).toBe(2500);
  });

  it('reads an address as the filter, with its role', () => {
    expect(parse(`monitor transfers to ${WALLET}`)).toEqual({ chainId: 43114, kind: 'transfers', to: WALLET, title: 'Token transfers to 0x1234…5678' });
    expect(parse(`monitor usdc sent from ${WALLET}`)).toMatchObject({ token: { address: USDC }, from: WALLET });
    expect(parse(`watch ${WALLET}`)).toMatchObject({ kind: 'transfers', involving: WALLET });
  });

  it('reads an L1 coin by its symbol', () => {
    expect(parseMonitor('monitor gun transfers', { chainId: 43419, symbol: 'GUN' }, new Map())).toEqual({ chainId: 43419, kind: 'native', coin: 'GUN', title: 'GUN transfers' });
  });

  it('leaves every other question to the SQL engine', () => {
    for (const q of ['how many usdt transfers today', 'monitor aave liquidations', 'monitor gas price', 'live validators', 'monitor transfers', 'watch the market']) {
      expect(parse(q), q).toBeNull();
    }
    expect(mayBeMonitor('top contracts by gas today')).toBe(false);
  });
});
