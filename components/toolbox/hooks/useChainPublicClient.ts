import { useMemo } from 'react';
import { createPublicClient, http, type PublicClient, type Hex, type TransactionReceipt } from 'viem';
import { useViemChainStore } from '../stores/toolboxStore';

/**
 * Returns a public client bound to the currently-selected L1 chain.
 *
 * The global `publicClient` in walletStore is initialised once and may be
 * hard-coded to Fuji for non-Core wallets.  This hook creates a client
 * from the viemChain (derived from l1ListStore + walletChainId), so reads
 * and receipt-polling always target the correct RPC.
 *
 * `waitForTransactionReceipt` is overridden to handle Avalanche's public
 * C-Chain RPC rejecting `eth_getBlockByNumber(blockN, true)` for blocks
 * that haven't finalized yet ("cannot query unfinalized data") — viem
 * internally fetches the receipt's block to detect reorgs, which the RPC
 * doesn't allow. When that error surfaces, fall back to direct
 * `eth_getTransactionReceipt` polling, which the RPC accepts.
 */
export function useChainPublicClient(): PublicClient | null {
  const viemChain = useViemChainStore();

  return useMemo(() => {
    if (!viemChain) return null;
    const base = createPublicClient({
      chain: viemChain,
      transport: http(viemChain.rpcUrls.default.http[0]),
      batch: {
        multicall: {
          deployless: true,
        },
      },
    });

    const originalWait = base.waitForTransactionReceipt.bind(base);
    base.waitForTransactionReceipt = (async (args: Parameters<typeof originalWait>[0]) => {
      try {
        return await originalWait(args);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/cannot query unfinalized data|Missing or invalid parameters/i.test(msg)) {
          throw err;
        }
        return await pollReceiptDirect(base, args.hash, {
          timeoutMs: args.timeout ?? 180_000,
          intervalMs: args.pollingInterval ?? 2_000,
        });
      }
    }) as typeof base.waitForTransactionReceipt;

    return base;
  }, [viemChain]);
}

async function pollReceiptDirect(
  client: PublicClient,
  hash: Hex,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number },
): Promise<TransactionReceipt> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = (await client.request({
        method: 'eth_getTransactionReceipt' as const,
        params: [hash] as const,
      } as never)) as unknown as TransactionReceipt | null;
      if (receipt) return receipt;
    } catch {
      // ignore and retry — the RPC is allowed to return null mid-mine
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for receipt of ${hash} after ${timeoutMs}ms`);
}
