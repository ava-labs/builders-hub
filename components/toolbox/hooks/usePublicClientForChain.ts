'use client';

import { useMemo } from 'react';
import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { useL1List } from '../stores/l1ListStore';
import type { L1ListItem } from '../stores/l1ListStore';

/**
 * Non-hook factory variant of {@link usePublicClientForChain}.
 *
 * Use this in async handlers, loops, and other places where React
 * hooks can't run. When passing a blockchain ID (not a URL), you must
 * pass the `l1List` so it can be looked up — typically grabbed once at
 * the component top level with `useL1List()` and closed over.
 *
 * @example
 *   const l1List = useL1List();
 *   for (const chain of selectedChains) {
 *     const client = makePublicClientForChain(chain.rpcUrl);
 *     ...
 *   }
 */
export function makePublicClientForChain(
  chainRefOrRpcUrl: string | null | undefined,
  l1List: L1ListItem[] = [],
  chain?: Chain,
): PublicClient | null {
  if (!chainRefOrRpcUrl) return null;

  const rpcUrl =
    chainRefOrRpcUrl.startsWith('http://') || chainRefOrRpcUrl.startsWith('https://')
      ? chainRefOrRpcUrl
      : (WELL_KNOWN_RPC[chainRefOrRpcUrl] ?? l1List.find((l1) => l1.id === chainRefOrRpcUrl)?.rpcUrl);

  if (!rpcUrl) return null;

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: {
      multicall: {
        deployless: true,
      },
    },
  }) as PublicClient;
}

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
 * Accepts either:
 *   - a **blockchain ID** (base58 string, e.g. the Subnet-EVM chain id
 *     returned by `useVMCAddress`) → resolved via well-known map or
 *     `l1ListStore.rpcUrl`
 *   - a **full RPC URL** (`http://` or `https://`) → used directly.
 *     Useful at call sites that already hold the URL (from a selected L1,
 *     a form input, or an externally-scoped config).
 *
 * Resolution order for blockchain IDs:
 *   1. Well-known C-Chain blockchain IDs → standard public RPC. Works
 *      even if the user's `l1ListStore` has been customized to drop the
 *      C-Chain entry.
 *   2. `l1ListStore` lookup by `id` → the L1's configured `rpcUrl`.
 *   3. `null` — caller must handle gracefully (show a skeleton or a
 *      "chain not recognised" message rather than a raw viem error).
 *
 * Returns `null` when the argument is null/undefined/unresolvable. For
 * reads against the wallet's *current* chain, use
 * {@link useChainPublicClient} instead — it reads from `walletStore` and
 * doesn't need a chain reference.
 *
 * @example
 *   // By blockchain ID (most common)
 *   const vmcClient = usePublicClientForChain(validatorManager.blockchainId);
 *
 *   // By RPC URL (when only the URL is in scope)
 *   const l1Client = usePublicClientForChain(selectedL1?.rpcUrl);
 */
export function usePublicClientForChain(chainRefOrRpcUrl: string | null | undefined): PublicClient | null {
  const l1List = useL1List();

  return useMemo(() => makePublicClientForChain(chainRefOrRpcUrl, l1List), [chainRefOrRpcUrl, l1List]);
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
