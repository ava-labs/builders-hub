'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAbi, formatUnits } from 'viem';
import type { PublicClient } from 'viem';
import { useL1List } from '@/components/toolbox/stores/l1ListStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import {
  mergeCandidates,
  normalizeAddress,
  extractKnownCandidates,
} from '@/lib/console/my-l1/token-discovery';
import {
  addUserToken,
  getUserTokens,
  removeUserToken,
} from '@/lib/console/my-l1/token-storage';

// Standard ERC-20 read-only surface. Inlined via parseAbi rather than
// extending `abi/ERC20.json` because that file is consumed elsewhere as
// an event-only ABI — adding functions would risk breaking those callers.
const ERC20_READ_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
]);

const REFRESH_INTERVAL_MS = 15_000;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type TokenSource = 'ictt' | 'wrapped' | 'user-added';

export interface TokenBalance {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  source: TokenSource;
}

export interface UseL1TokenBalancesResult {
  tokens: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  /** Force a refresh (re-runs balance reads but reuses cached metadata
   *  for already-validated addresses). */
  refresh: () => void;
  /** Validates the address on-chain, persists, and triggers a refresh.
   *  Resolves to `{ ok: true }` on success or `{ ok: false, error }` if
   *  the address isn't an ERC-20 on this L1. */
  addToken: (address: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeToken: (address: string) => void;
  /** True when the wallet isn't connected to this L1 — the UI uses this
   *  to render a "switch your wallet" placeholder rather than a list. */
  isWalletOnL1: boolean;
}

export interface UseL1TokenBalancesOptions {
  l1: CombinedL1;
  userAddress: `0x${string}` | '';
  /** When false, the hook skips network reads and renders the placeholder
   *  state. The wallet-switch transition flips this and the hook resumes. */
  enabled: boolean;
}

interface ValidatedToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  source: TokenSource;
}

function classifySource(
  address: `0x${string}`,
  wrappedAddress: `0x${string}` | null,
  userAdded: Set<string>,
): TokenSource {
  if (wrappedAddress && address === wrappedAddress) return 'wrapped';
  if (userAdded.has(address)) return 'user-added';
  return 'ictt';
}

async function fetchDiscoveryAddresses(blockchainId: string, signal: AbortSignal): Promise<string[]> {
  try {
    const response = await fetch(
      `/api/l1-tokens/discover?blockchainId=${encodeURIComponent(blockchainId)}`,
      { signal },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { addresses?: string[] };
    return Array.isArray(data.addresses) ? data.addresses : [];
  } catch (err) {
    // Network/abort failures degrade silently. The user-added path and
    // wrapped-token candidate keep the list non-empty.
    if ((err as Error).name !== 'AbortError') {
      console.warn('Token discovery failed:', err);
    }
    return [];
  }
}

interface MetadataResult {
  symbol: string;
  name: string;
  decimals: number;
}

async function readMetadataMulticall(
  client: PublicClient,
  addresses: `0x${string}`[],
): Promise<Map<`0x${string}`, MetadataResult>> {
  if (addresses.length === 0) return new Map();

  const calls = addresses.flatMap((address) => [
    { address, abi: ERC20_READ_ABI, functionName: 'symbol' as const },
    { address, abi: ERC20_READ_ABI, functionName: 'name' as const },
    { address, abi: ERC20_READ_ABI, functionName: 'decimals' as const },
  ]);

  // Type assertion is needed because viem's multicall infers a union
  // result type per call; we only care that each triplet either fully
  // succeeded or any element failed (drop the candidate either way).
  const results = (await client.multicall({
    contracts: calls,
    allowFailure: true,
  })) as Array<{ status: 'success'; result: unknown } | { status: 'failure' }>;

  const out = new Map<`0x${string}`, MetadataResult>();
  for (let i = 0; i < addresses.length; i++) {
    const symbolResult = results[i * 3];
    const nameResult = results[i * 3 + 1];
    const decimalsResult = results[i * 3 + 2];

    if (
      symbolResult?.status !== 'success' ||
      nameResult?.status !== 'success' ||
      decimalsResult?.status !== 'success'
    ) {
      continue;
    }

    const symbol = symbolResult.result;
    const name = nameResult.result;
    const decimals = decimalsResult.result;

    if (typeof symbol !== 'string' || typeof name !== 'string' || typeof decimals !== 'number') {
      continue;
    }

    out.set(addresses[i], { symbol, name, decimals });
  }

  return out;
}

async function readBalancesMulticall(
  client: PublicClient,
  addresses: `0x${string}`[],
  userAddress: `0x${string}`,
): Promise<Map<`0x${string}`, bigint>> {
  if (addresses.length === 0) return new Map();

  const calls = addresses.map((address) => ({
    address,
    abi: ERC20_READ_ABI,
    functionName: 'balanceOf' as const,
    args: [userAddress] as const,
  }));

  const results = (await client.multicall({
    contracts: calls,
    allowFailure: true,
  })) as Array<{ status: 'success'; result: bigint } | { status: 'failure' }>;

  const out = new Map<`0x${string}`, bigint>();
  for (let i = 0; i < addresses.length; i++) {
    const r = results[i];
    if (r?.status === 'success') {
      out.set(addresses[i], r.result);
    }
  }
  return out;
}

export function useL1TokenBalances({
  l1,
  userAddress,
  enabled,
}: UseL1TokenBalancesOptions): UseL1TokenBalancesResult {
  const l1List = useL1List();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bump this to force a re-run of the discovery+balance pipeline (used
  // by addToken / removeToken / explicit refresh). Plain counter rather
  // than a refresh ref so multiple back-to-back updates collapse to one
  // effect run via React batching.
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Persist validated metadata across refreshes so the 15s interval only
  // re-fetches balances. ERC-20 symbol/name/decimals are immutable so
  // this never goes stale within a session.
  const metadataCacheRef = useRef<Map<`0x${string}`, MetadataResult>>(new Map());
  // Addresses we already validated and confirmed are NOT ERC-20s on this
  // L1. Avoid re-querying every refresh.
  const invalidCacheRef = useRef<Set<`0x${string}`>>(new Set());
  // Reset both caches whenever the L1 changes — metadata from L1 A means
  // nothing on L1 B even if some L1 happens to have a contract at the
  // same address.
  useEffect(() => {
    metadataCacheRef.current = new Map();
    invalidCacheRef.current = new Set();
  }, [l1.blockchainId, l1.evmChainId]);

  const wrappedAddress = useMemo<`0x${string}` | null>(
    () => extractKnownCandidates(l1)[0] ?? null,
    [l1],
  );

  const refresh = useCallback(() => {
    setRefreshCounter((n) => n + 1);
  }, []);

  // Main pipeline: discover → merge → validate (metadata) → balances.
  useEffect(() => {
    if (!enabled || !userAddress) {
      setTokens([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const client = makePublicClientForChain(l1.rpcUrl, l1List);
        if (!client) {
          setError('No RPC URL configured for this L1');
          setTokens([]);
          setIsLoading(false);
          return;
        }

        const userAdded = getUserTokens(l1.evmChainId, userAddress);
        const userAddedSet = new Set<string>(userAdded);

        const apiAddresses = l1.blockchainId
          ? await fetchDiscoveryAddresses(l1.blockchainId, controller.signal)
          : [];
        if (cancelled) return;

        const { candidates } = mergeCandidates({
          apiAddresses,
          l1,
          userAddedAddresses: userAdded,
        });

        // Skip candidates we've already proved invalid this session, and
        // skip metadata lookup for ones we already know.
        const needMetadata = candidates.filter(
          (addr) => !metadataCacheRef.current.has(addr) && !invalidCacheRef.current.has(addr),
        );

        if (needMetadata.length > 0) {
          const fresh = await readMetadataMulticall(client, needMetadata);
          if (cancelled) return;
          for (const addr of needMetadata) {
            const meta = fresh.get(addr);
            if (meta) {
              metadataCacheRef.current.set(addr, meta);
            } else {
              invalidCacheRef.current.add(addr);
            }
          }
        }

        const validAddresses = candidates.filter((addr) => metadataCacheRef.current.has(addr));
        const balanceMap = await readBalancesMulticall(client, validAddresses, userAddress);
        if (cancelled) return;

        const result: TokenBalance[] = validAddresses.map((addr) => {
          const meta = metadataCacheRef.current.get(addr)!;
          const balance = balanceMap.get(addr) ?? 0n;
          return {
            address: addr,
            symbol: meta.symbol,
            name: meta.name,
            decimals: meta.decimals,
            balance,
            balanceFormatted: formatUnits(balance, meta.decimals),
            source: classifySource(addr, wrappedAddress, userAddedSet),
          };
        });

        // Sort: non-zero balances first, then by symbol alphabetically.
        // Within the non-zero group, larger balances surface first.
        result.sort((a, b) => {
          const aHas = a.balance > 0n ? 1 : 0;
          const bHas = b.balance > 0n ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          if (aHas === 1) {
            // Compare formatted numerics — comparing bigints across
            // different decimals would over-rank high-decimal tokens.
            const af = parseFloat(a.balanceFormatted);
            const bf = parseFloat(b.balanceFormatted);
            if (af !== bf) return bf - af;
          }
          return a.symbol.localeCompare(b.symbol);
        });

        setTokens(result);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('useL1TokenBalances failed:', err);
        setError('Failed to load token balances');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    const interval = setInterval(() => void run(), REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [enabled, userAddress, l1, l1List, wrappedAddress, refreshCounter]);

  const addToken = useCallback(
    async (address: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const normalized = normalizeAddress(address);
      if (!normalized) {
        return { ok: false, error: 'Not a valid contract address' };
      }
      if (!ADDRESS_RE.test(address.trim())) {
        return { ok: false, error: 'Not a valid contract address' };
      }
      if (!userAddress) {
        return { ok: false, error: 'Connect your wallet first' };
      }

      const client = makePublicClientForChain(l1.rpcUrl, l1List);
      if (!client) {
        return { ok: false, error: 'No RPC URL configured for this L1' };
      }

      // Validate on-chain BEFORE persisting — we don't want to pollute
      // localStorage with addresses that aren't actually ERC-20s on this
      // L1. A single multicall reads symbol+decimals; if either fails
      // the address doesn't satisfy the ERC-20 interface here.
      const metadata = await readMetadataMulticall(client, [normalized]);
      if (!metadata.has(normalized)) {
        return {
          ok: false,
          error: `No ERC-20 token found at this address on ${l1.chainName}`,
        };
      }

      // Prime the metadata cache so the next render shows the token
      // immediately without re-fetching its symbol/name/decimals.
      const meta = metadata.get(normalized)!;
      metadataCacheRef.current.set(normalized, meta);
      invalidCacheRef.current.delete(normalized);

      addUserToken(l1.evmChainId, userAddress, normalized);
      refresh();
      return { ok: true };
    },
    [l1.rpcUrl, l1.evmChainId, l1.chainName, l1List, userAddress, refresh],
  );

  const removeToken = useCallback(
    (address: string) => {
      if (!userAddress) return;
      removeUserToken(l1.evmChainId, userAddress, address);
      refresh();
    },
    [l1.evmChainId, userAddress, refresh],
  );

  return {
    tokens,
    isLoading,
    error,
    refresh,
    addToken,
    removeToken,
    isWalletOnL1: enabled,
  };
}
