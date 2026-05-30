import { createPChainClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';

/**
 * Polls the P-Chain for a transaction's status until it is Committed or Dropped.
 * Replicates the pattern from usePChainNotifications.waitForTransaction
 * but is available as a standalone async function for use in components
 * that need to gate success state on actual on-chain confirmation.
 */
export async function waitForPChainConfirmation(
  txID: string,
  isTestnet: boolean,
  maxAttempts = 30,
  interval = 2000,
): Promise<void> {
  const client = createPChainClient({
    chain: isTestnet ? avalancheFuji : avalanche,
    transport: { type: 'http' },
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receipt = await client.getTxStatus({ txID });
    if (receipt.status === 'Committed') {
      return;
    }
    if (receipt.status === 'Dropped') {
      throw new Error(`P-Chain transaction was dropped (${txID})`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`P-Chain transaction confirmation timeout after ${(maxAttempts * interval) / 1000}s (${txID})`);
}
