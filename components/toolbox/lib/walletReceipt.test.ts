import { describe, expect, it, vi } from 'vitest';
import type { TransactionReceipt } from 'viem';
import { ReceiptUnknownError, waitForReceiptWithWalletFallback } from './walletReceipt';

const HASH = '0xf4f5e50280260cc192c352e387d44e736d2c0fb317a8ee8199313777e98495c2' as const;
const RECEIPT = {
  status: 'success',
  contractAddress: '0x673bAB14A759DA3388EeA64d5061b0525391f4e5',
} as unknown as TransactionReceipt;

function pageClientResolving(receipt: TransactionReceipt) {
  return { waitForTransactionReceipt: vi.fn().mockResolvedValue(receipt) };
}

function pageClientRejecting(err: Error) {
  return { waitForTransactionReceipt: vi.fn().mockRejectedValue(err) };
}

describe('waitForReceiptWithWalletFallback', () => {
  it('passes the page receipt through when the wait succeeds', async () => {
    const rescue = vi.fn();
    const receipt = await waitForReceiptWithWalletFallback(pageClientResolving(RECEIPT), HASH, { rescue });
    expect(receipt).toBe(RECEIPT);
    expect(rescue).not.toHaveBeenCalled();
  });

  it('rescues a timed-out wait through the wallet transport', async () => {
    const rescue = vi.fn().mockResolvedValue(RECEIPT);
    const receipt = await waitForReceiptWithWalletFallback(
      pageClientRejecting(new Error(`Timed out while waiting for transaction with hash "${HASH}" to be confirmed.`)),
      HASH,
      { rescue },
    );
    expect(receipt).toBe(RECEIPT);
    expect(rescue).toHaveBeenCalledWith(HASH);
  });

  it('throws ReceiptUnknownError (never "failed") when neither side can produce the receipt', async () => {
    const rescue = vi.fn().mockResolvedValue(null);
    const promise = waitForReceiptWithWalletFallback(pageClientRejecting(new TypeError('Failed to fetch')), HASH, {
      rescue,
    });
    await expect(promise).rejects.toBeInstanceOf(ReceiptUnknownError);
    await expect(promise).rejects.toSatisfy((err: ReceiptUnknownError) => {
      return err.txHash === HASH && !err.message.toLowerCase().includes('failed') && err.message.includes(HASH);
    });
  });

  it('rethrows real failures untouched (reverts, rejections)', async () => {
    const rescue = vi.fn();
    const revert = new Error('execution reverted: churn rate exceeded');
    await expect(waitForReceiptWithWalletFallback(pageClientRejecting(revert), HASH, { rescue })).rejects.toBe(revert);
    expect(rescue).not.toHaveBeenCalled();
  });
});
