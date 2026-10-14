import { describe, expect, it } from 'vitest';
import { UserRejectedRequestError, SwitchChainError } from 'viem';
import { isUserRejection } from '@/components/toolbox/hooks/useWalletSwitch';

describe('isUserRejection', () => {
  it('finds code 4001 on the error', () => {
    expect(isUserRejection({ code: 4001, message: 'User rejected the request.' })).toBe(true);
  });

  it('finds code 4001 in the cause chain of a viem error', () => {
    const rejected = new UserRejectedRequestError(new Error('User rejected the request.'));
    expect(isUserRejection(rejected)).toBe(true);
    expect(isUserRejection(new Error('wrapped', { cause: rejected }))).toBe(true);
  });

  it('finds a refusal from the message when there is no code', () => {
    expect(isUserRejection(new Error('MetaMask Tx Signature: User denied transaction signature.'))).toBe(true);
  });

  it('is false for other wallet errors', () => {
    expect(isUserRejection(new SwitchChainError(new Error('Unrecognized chain ID')))).toBe(false);
    expect(isUserRejection({ code: 4902 })).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
    expect(isUserRejection('error')).toBe(false);
  });
});
