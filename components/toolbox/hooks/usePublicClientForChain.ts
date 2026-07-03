'use client';

import { useMemo } from 'react';
import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { useL1List } from '../stores/l1ListStore';
import { useWalletStore } from '../stores/walletStore';
import type { L1ListItem } from '../stores/l1ListStore';

/**
 * Non-zero placeholder used as `tx.origin` for read calls when the wallet
 * is disconnected. Subnet-EVM's Contract Deployer Allowlist precompile
 * rejects `eth_call` with `tx.origin = 0x0` ("not authorized to deploy a
 * contract") — viem's default. Passing any non-zero address bypasses that
 * specific failure mode without affecting reads on chains that don't have
 * the precompile (the `from` field is just informational for them).
 */
const PREVIEW_ACCOUNT = '0x0000000000000000000000000000000000000001' as const;

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

  // No `batch.multicall`: viem's deployless multicall fallback issues a
  // contract-creation `eth_call`, which the Subnet-EVM Contract Deployer
  // Allowlist precompile rejects on permissioned L1s (for any `from`).
  // Single reads use plain `eth_call`; batch call sites opt into
  // `multicall({ deployless: true })` explicitly with a sequential fallback.
  const base = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Wrap `readContract` to auto-inject the connected wallet address as the
  // `account` (→ `from` in eth_call → `tx.origin` in the EVM). Without this,
  // viem defaults `tx.origin` to `0x0`, which the Subnet-EVM Contract
  // Deployer Allowlist precompile rejects with "tx.origin 0x0…0 is not
  // authorized to deploy a contract" — blocking every cross-chain read on
  // L1s that enable the precompile.
  //
  // Per-call `account:` overrides still work (the override happens only
  // when the caller didn't specify one). Reading is synchronous off the
  // zustand store, so there's no hook/render dance — safe to call from
  // any context.
  const originalReadContract = base.readContract.bind(base);
  type ReadContractFn = typeof originalReadContract;
  const readContract: ReadContractFn = ((params: Parameters<ReadContractFn>[0]) => {
    const walletAddress = useWalletStore.getState().walletEVMAddress;
    const existingAccount = (params as { account?: `0x${string}` | { address?: `0x${string}` } }).account;
    const account = existingAccount ?? (walletAddress && walletAddress.length > 0 ? walletAddress : PREVIEW_ACCOUNT);
    return originalReadContract({ ...params, account } as Parameters<ReadContractFn>[0]);
  }) as ReadContractFn;

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'readContract') return readContract;
      return Reflect.get(target, prop, receiver);
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
