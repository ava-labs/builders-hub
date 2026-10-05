import { describe, expect, it } from 'vitest';
import {
  findERC20FaucetToken,
  formatERC20Balance,
  getERC20ClaimScope,
  getERC20DripAmount,
} from '@/lib/faucet/erc20';
import type { ERC20FaucetToken } from '@/components/toolbox/stores/l1ListStore';

const WAVAX: ERC20FaucetToken = {
  address: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
  name: 'Wrapped AVAX',
  symbol: 'WAVAX',
  decimals: 18,
  kind: 'wrapped-native',
  faucetThresholds: { threshold: 0.1, dripAmount: 0.25 },
};

const USDC: ERC20FaucetToken = {
  address: '0x5425890298aed601595a70AB815c96711a31Bc65',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  kind: 'erc20',
  faucetThresholds: { threshold: 5, dripAmount: 10 },
};

describe('getERC20ClaimScope', () => {
  it('folds the lowercase token address into the chain scope', () => {
    expect(getERC20ClaimScope(43113, WAVAX.address)).toBe(
      '43113:0xd00ae08403b9bbb9124bb305c09058e32c39a48c',
    );
  });

  it('produces the same scope regardless of address casing or chain id type', () => {
    expect(getERC20ClaimScope('43113', WAVAX.address.toUpperCase().replace('0X', '0x'))).toBe(
      getERC20ClaimScope(43113, WAVAX.address.toLowerCase()),
    );
  });

  it('keeps tokens on the same chain in separate scopes', () => {
    expect(getERC20ClaimScope(43113, WAVAX.address)).not.toBe(getERC20ClaimScope(43113, USDC.address));
  });
});

describe('findERC20FaucetToken', () => {
  const chain = { erc20Faucets: [WAVAX, USDC] };

  it('matches case-insensitively', () => {
    expect(findERC20FaucetToken(chain, WAVAX.address.toLowerCase())).toBe(WAVAX);
    expect(findERC20FaucetToken(chain, USDC.address)).toBe(USDC);
  });

  it('returns undefined for unknown tokens, malformed addresses and chains without faucets', () => {
    expect(findERC20FaucetToken(chain, '0x0000000000000000000000000000000000000001')).toBeUndefined();
    expect(findERC20FaucetToken(chain, 'not-an-address')).toBeUndefined();
    expect(findERC20FaucetToken({ erc20Faucets: undefined }, WAVAX.address)).toBeUndefined();
    expect(findERC20FaucetToken(undefined, WAVAX.address)).toBeUndefined();
  });
});

describe('getERC20DripAmount', () => {
  it('scales the configured drip by the token decimals', () => {
    expect(getERC20DripAmount(WAVAX)).toEqual({ raw: 250_000_000_000_000_000n, formatted: '0.25' });
    expect(getERC20DripAmount(USDC)).toEqual({ raw: 10_000_000n, formatted: '10' });
  });
});

describe('formatERC20Balance', () => {
  it('formats raw balances with the token decimals', () => {
    expect(formatERC20Balance(1_234_567n, 6)).toBe('1.23');
    expect(formatERC20Balance(0n, 18)).toBe('0.00');
    expect(formatERC20Balance(1_500_000_000_000_000_000n, 18, 1)).toBe('1.5');
  });
});
