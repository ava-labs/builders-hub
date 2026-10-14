import { describe, expect, it } from 'vitest';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';
import {
  INVALID_BLS_KEY_TEXT,
  overBalanceText,
  overBalanceWithFeeText,
  stakeBalanceError,
  stakeTxErrorText,
} from '@/components/toolbox/utils/stakeTxText';

const OVER_13 =
  'The stake is more than your P-Chain balance (13.376494261 AVAX). ' +
  'Move AVAX to the P-Chain with the C-Chain to P-Chain bridge.';

const FEE_OVER_13 =
  'The stake and the transaction fee are more than your P-Chain balance (13.376494261 AVAX). ' +
  'Enter a smaller stake, or move AVAX to the P-Chain with the C-Chain to P-Chain bridge.';

// As avalanchejs throws it for a stake above the balance (hand repro, F-05)
const SDK_INSUFFICIENT =
  'Insufficient funds! Provided UTXOs need 486623505739 more units of asset ' +
  'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK to stake';

describe('stakeBalanceError', () => {
  it('refuses a stake above a known P-Chain balance', () => {
    expect(stakeBalanceError(500, 13.376494261)).toBe(OVER_13);
  });

  it('allows a stake up to the balance', () => {
    expect(stakeBalanceError(1, 13.376494261)).toBeNull();
    expect(stakeBalanceError(13.376494261, 13.376494261)).toBeNull();
  });

  it('does not check a balance that is not known yet (0) or not a number', () => {
    expect(stakeBalanceError(1, 0)).toBeNull();
    expect(stakeBalanceError(1, Number.NaN)).toBeNull();
  });
});

describe('stakeTxErrorText', () => {
  it('turns the SDK insufficient-funds error into the balance text for a stake above the balance', () => {
    expect(stakeTxErrorText(new Error(SDK_INSUFFICIENT), 500, 13.376494261)).toBe(OVER_13);
  });

  it('gives the stake-and-fee text for a stake equal to the balance, which the form allows', () => {
    expect(stakeBalanceError(13.376494261, 13.376494261)).toBeNull();
    expect(stakeTxErrorText(new Error(SDK_INSUFFICIENT), 13.376494261, 13.376494261)).toBe(FEE_OVER_13);
  });

  it('gives the stake-and-fee text for a stake just below the balance', () => {
    expect(stakeTxErrorText(new Error(SDK_INSUFFICIENT), 13.376, 13.376494261)).toBe(FEE_OVER_13);
  });

  it('keeps the stake text when the balance is not known yet (0)', () => {
    expect(stakeTxErrorText(new Error(SDK_INSUFFICIENT), 1, 0)).toBe(overBalanceText(0));
  });

  it('turns an invalid BLS public key into the BLS text', () => {
    expect(stakeTxErrorText(new Error('Cannot find square root'), 1, 13)).toBe(INVALID_BLS_KEY_TEXT);
  });

  it('gives the one rejection text for a wallet rejection', () => {
    expect(stakeTxErrorText(new Error('User rejected the request.'), 1, 13)).toBe(WALLET_REJECTED_TEXT);
  });

  it('keeps every other error as it is', () => {
    expect(stakeTxErrorText(new Error('HTTP 503'), 1, 13)).toBe('HTTP 503');
  });

  it('writes the balance with no float noise', () => {
    expect(overBalanceText(0)).toContain('(0 AVAX)');
    expect(overBalanceText(1.1)).toContain('(1.1 AVAX)');
    expect(overBalanceWithFeeText(1.1)).toContain('(1.1 AVAX)');
  });
});
