import { useMemo } from 'react';
import { createPublicClient, http, type PublicClient } from 'viem';
import { useViemChainStore } from '../stores/toolboxStore';

/**
 * Returns a public client bound to the currently-selected L1 chain.
 *
 * The global `publicClient` in walletStore is initialised once and may be
 * hard-coded to Fuji for non-Core wallets.  This hook creates a client
 * from the viemChain (derived from l1ListStore + walletChainId), so reads
 * and receipt-polling always target the correct RPC.
 */
export function useChainPublicClient(): PublicClient | null {
  const viemChain = useViemChainStore();

  return useMemo(() => {
    if (!viemChain) return null;
    return createPublicClient({
      chain: viemChain,
      transport: http(viemChain.rpcUrls.default.http[0]),
      batch: {
        multicall: {
          deployless: true,
        },
      },
    });
  }, [viemChain]);
}
