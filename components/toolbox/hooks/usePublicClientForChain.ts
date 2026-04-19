'use client';

import { useMemo } from 'react';
import { createPublicClient, http, type PublicClient } from 'viem';
import { useL1List } from '../stores/l1ListStore';
import type { L1ListItem } from '../stores/l1ListStore';

/**
 * Returns a viem public client for reading contracts on a specific
 * Avalanche chain, **independent of the wallet's currently-selected
 * network**.
 *
 * Use this for cross-chain reads — e.g. reading a Validator Manager on
 * C-Chain while the user's wallet is connected to their L1. The wallet's
 * chain only matters for writes (signing txs); reads should always target
 * the chain that actually hosts the contract.
 *
 * Resolution order:
 *   1. Well-known C-Chain blockchain IDs → standard public RPC. This
 *      works even if the user's `l1ListStore` has been customized to
 *      drop the C-Chain entry.
 *   2. `l1ListStore` lookup by `id` → the L1's configured `rpcUrl`.
 *   3. `null` — caller must handle gracefully (show a skeleton or a
 *      "chain not recognised" message rather than a raw viem error).
 *
 * Returns `null` when `blockchainId` is null/undefined/unresolvable. For
 * reads against the wallet's *current* chain, use
 * {@link useChainPublicClient} instead — it reads from `walletStore` and
 * doesn't need a chain reference.
 *
 * @example
 *   const vmcClient = usePublicClientForChain(validatorManager.blockchainId);
 *   const owner = await vmcClient?.readContract({ ... });
 */
export function usePublicClientForChain(blockchainId: string | null | undefined): PublicClient | null {
  const l1List = useL1List();

  return useMemo(() => {
    if (!blockchainId) return null;

    // 1. Well-known C-Chain RPCs — guaranteed to resolve even if the
    //    user's L1 list has been trimmed. These IDs are invariants
    //    baked into the Avalanche network and safe to hardcode.
    const rpcUrl = WELL_KNOWN_RPC[blockchainId] ?? l1List.find((l1: L1ListItem) => l1.id === blockchainId)?.rpcUrl;

    if (!rpcUrl) return null;

    return createPublicClient({
      transport: http(rpcUrl),
      batch: {
        multicall: {
          deployless: true,
        },
      },
    }) as PublicClient;
  }, [blockchainId, l1List]);
}

/**
 * Avalanche chains whose blockchain IDs and public RPCs are
 * network-level invariants. Hardcoded so the hook still works when a
 * user's customized `l1ListStore` doesn't include them.
 */
const WELL_KNOWN_RPC: Record<string, string> = {
  // Fuji testnet C-Chain
  yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp: 'https://api.avax-test.network/ext/bc/C/rpc',
  // Mainnet C-Chain
  '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5': 'https://api.avax.network/ext/bc/C/rpc',
};
