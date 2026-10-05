import { describe, expect, it } from 'vitest';

import { declaredSymbol, type TokenMap } from '@/lib/token-list';

const listed: TokenMap = new Map([
  ['0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', { symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: null }],
  ['0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', { symbol: 'WAVAX', name: 'Wrapped AVAX', decimals: 18, logoURI: null }],
]);

describe('declaredSymbol', () => {
  it('keeps a plain symbol no listed token has', () => {
    expect(declaredSymbol('COQ', listed, 'AVAX')).toBe('COQ');
    expect(declaredSymbol('BTC.b', listed, 'AVAX')).toBe('BTC.b');
  });

  it("refuses a listed token's symbol in any case, and the chain's coin", () => {
    expect(declaredSymbol('USDC', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('usdc', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('WAVAX', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('avax', listed, 'AVAX')).toBeNull();
  });

  it('refuses spam: a link, spaces, lookalike letters, a long text, nothing', () => {
    expect(declaredSymbol('claim at x.com/free', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('USD C', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('\uff35\uff33\uff24\uff23', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('ABCDEFGHIJKLMNOPQ', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol('', listed, 'AVAX')).toBeNull();
    expect(declaredSymbol(undefined, listed, 'AVAX')).toBeNull();
  });
});
