import { describe, expect, it } from 'vitest';
import { classifyEvmTxError } from './evmErrors';

const HASH = '0xf4f5e50280260cc192c352e387d44e736d2c0fb317a8ee8199313777e98495c2';

describe('classifyEvmTxError', () => {
  it("maps Core's gas-limit text to the wallet's own RPC, not the page's", () => {
    const classified = classifyEvmTxError(
      new Error('An internal error was received.\n\nDetails: Unable to calculate gas limit: Failed to fetch'),
    );
    expect(classified.kind).toBe('wallet-rpc-unreachable');
    expect(classified.message).toMatch(/wallet/i);
    expect(classified.message).toMatch(/network settings|networks/i);
  });

  it('maps the viem receipt timeout by message and extracts the hash, never saying failed', () => {
    const classified = classifyEvmTxError(
      new Error(`Timed out while waiting for transaction with hash "${HASH}" to be confirmed.`),
    );
    expect(classified.kind).toBe('receipt-timeout');
    expect(classified.txHash).toBe(HASH);
    expect(classified.message).toMatch(/may still have landed|may have landed|not confirmed/i);
    expect(classified.message.toLowerCase()).not.toContain('failed');
  });

  it('maps the viem receipt timeout by error name too', () => {
    const err = new Error('whatever');
    err.name = 'WaitForTransactionReceiptTimeoutError';
    (err as Error & { hash: string }).hash = HASH;
    const classified = classifyEvmTxError(err);
    expect(classified.kind).toBe('receipt-timeout');
    expect(classified.txHash).toBe(HASH);
  });

  it('maps page fetch failures to rpc-unreachable, naming mixed content when the context proves it', () => {
    const plain = classifyEvmTxError(new TypeError('Failed to fetch'));
    expect(plain.kind).toBe('rpc-unreachable');
    expect(plain.message.toLowerCase()).not.toContain('mixed content');

    const mixed = classifyEvmTxError(new TypeError('Failed to fetch'), {
      rpcUrl: 'http://18.222.144.186:9650/ext/bc/xyz/rpc',
      pageProtocol: 'https:',
    });
    expect(mixed.kind).toBe('rpc-unreachable');
    expect(mixed.message).toMatch(/mixed content/i);
    expect(mixed.message).toMatch(/reverse proxy/i);
  });

  it('keeps revert reasons verbatim', () => {
    const classified = classifyEvmTxError(new Error('execution reverted: churn rate exceeded'));
    expect(classified.kind).toBe('reverted');
    expect(classified.message).toContain('churn rate exceeded');
  });

  it('recognizes user rejection by code and by message', () => {
    const byCode = new Error('denied') as Error & { code: number };
    byCode.code = 4001;
    expect(classifyEvmTxError(byCode).kind).toBe('user-rejected');
    expect(classifyEvmTxError(new Error('User rejected the request.')).kind).toBe('user-rejected');
  });

  it('passes unknown errors through with their original message', () => {
    const classified = classifyEvmTxError(new Error('some exotic condition'));
    expect(classified.kind).toBe('unknown');
    expect(classified.message).toBe('some exotic condition');
  });
});
