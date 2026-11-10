import { describe, expect, it } from 'vitest';
import { createPublicClient, custom } from 'viem';

import { pollReceiptDirect } from '@/components/toolbox/hooks/useChainPublicClient';

// A Fuji C-Chain receipt as eth_getTransactionReceipt returns it (a reverted tx).
const RAW_REVERTED = {
  blockHash: '0x97b04b38b9f9b2f163979cbca0c8e8b58df0e2b216ba9d29c2cde6a9d6363ad5',
  blockNumber: '0x380c3dd',
  contractAddress: null,
  cumulativeGasUsed: '0x186a0',
  effectiveGasPrice: '0xa0',
  from: '0x76202b74672bb10b897bf2f62b1e456f4e3a5225',
  gasUsed: '0x186a0',
  logs: [],
  logsBloom: `0x${'0'.repeat(512)}`,
  status: '0x0',
  to: '0x4be9e29313f9bf695ab1265a0f31ca9bfcc6360e',
  transactionHash: '0xe8b7c06c21be4b252fba15249a2ffc2b5a5b24e370b944f7723582a8c89f7728',
  transactionIndex: '0x0',
  type: '0x0',
};
const HASH = RAW_REVERTED.transactionHash as `0x${string}`;

/** A client whose RPC returns null for the first `pending` polls, then `raw`. */
function clientReturning(raw: object, pending = 1) {
  let calls = 0;
  return createPublicClient({
    transport: custom({
      async request({ method }) {
        if (method !== 'eth_getTransactionReceipt') throw new Error(`unexpected ${method}`);
        return calls++ < pending ? null : raw;
      },
    }),
  });
}

describe('pollReceiptDirect', () => {
  it('returns the receipt formatted, as waitForTransactionReceipt would', async () => {
    const ok = await pollReceiptDirect(clientReturning({ ...RAW_REVERTED, status: '0x1' }), HASH, {
      timeoutMs: 1000,
      intervalMs: 1,
    });
    expect(ok.status).toBe('success');
    expect(ok.gasUsed).toBe(100_000n);
    expect(ok.blockNumber).toBe(58_770_397n);

    const reverted = await pollReceiptDirect(clientReturning(RAW_REVERTED), HASH, { timeoutMs: 1000, intervalMs: 1 });
    expect(reverted.status).toBe('reverted');
  });

  it('times out when no receipt appears', async () => {
    await expect(
      pollReceiptDirect(clientReturning(RAW_REVERTED, Infinity), HASH, { timeoutMs: 20, intervalMs: 1 }),
    ).rejects.toThrow(/Timed out/);
  });
});
