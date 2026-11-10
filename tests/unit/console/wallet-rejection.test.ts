import { describe, expect, it } from 'vitest';
import { parseContractError } from '@/components/toolbox/hooks/contracts/parseContractError';
import { parsePChainError } from '@/components/toolbox/hooks/contracts/parsePChainError';
import { classifyEvmTxError } from '@/components/toolbox/lib/evmErrors';
import { WALLET_REJECTED_TEXT, failureText } from '@/components/toolbox/lib/walletRejection';

describe('the wallet rejection text', () => {
  it('tells the user what to do next', () => {
    expect(WALLET_REJECTED_TEXT).toBe(
      'You rejected the request in your wallet. To continue, click the button again and approve the request.',
    );
  });

  it('is the same for a contract call, a P-Chain tx and the Activity panel', () => {
    const rejected = new Error('User rejected the request.');
    expect(parseContractError(rejected)).toBe(WALLET_REJECTED_TEXT);
    expect(parsePChainError(rejected)).toBe(WALLET_REJECTED_TEXT);
    expect(classifyEvmTxError(rejected)).toEqual({ kind: 'user-rejected', message: WALLET_REJECTED_TEXT });
  });

  it('stays a rejection after a parser wraps it in a new Error (useContractActions)', () => {
    expect(classifyEvmTxError(new Error(parseContractError(new Error('User rejected the request.'))))).toEqual({
      kind: 'user-rejected',
      message: WALLET_REJECTED_TEXT,
    });
  });
});

describe('failureText', () => {
  it('shows a wallet rejection with no prefix', () => {
    expect(failureText('Transaction failed: ', WALLET_REJECTED_TEXT)).toBe(WALLET_REJECTED_TEXT);
  });

  it('adds the prefix to any other failure', () => {
    expect(failureText('Transaction failed: ', 'Insufficient funds for transaction')).toBe(
      'Transaction failed: Insufficient funds for transaction',
    );
  });
});
