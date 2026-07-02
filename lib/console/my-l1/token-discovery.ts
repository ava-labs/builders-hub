// Token-discovery helpers for the L1 dashboard's TokenList card. Pure
// functions, no React. The hook layer (`useL1TokenBalances`) composes
// these with API + on-chain validation calls.

import type { CombinedL1 } from './types';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Returns the address lowercased and `0x`-prefixed, or null if not a
 *  syntactically valid EVM address. */
export function normalizeAddress(value: string | undefined | null): `0x${string}` | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!ADDRESS_RE.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (lower === ZERO_ADDRESS) return null;
  return lower as `0x${string}`;
}

/** Case-insensitive dedupe. Preserves insertion order. */
export function dedupeAddresses(addresses: Array<string | undefined | null>): `0x${string}`[] {
  const seen = new Set<string>();
  const out: `0x${string}`[] = [];
  for (const raw of addresses) {
    const addr = normalizeAddress(raw);
    if (!addr) continue;
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

/** Token candidates derivable from L1ListItem metadata alone — currently
 *  just the wrapped native token. Future-proofed for hardcoded per-L1
 *  registries (e.g. "every L1 has token X if precompile Y is enabled"). */
export function extractKnownCandidates(l1: CombinedL1): `0x${string}`[] {
  return dedupeAddresses([l1.wrappedTokenAddress]);
}

/** Identifies which side of an ICTT bridge route the L1 sits on. Used by
 *  the UI to render a "Bridged from {chain}" badge — we look at the
 *  opposite end of the route from the L1. */
export interface BridgeRouteHint {
  /** The token address — same value the on-chain probe will validate. */
  address: `0x${string}`;
  /** Human-readable chain name from the opposite end of the bridge. */
  counterpartyChainName: string;
}

export interface DiscoveryInput {
  apiAddresses: string[];
  l1: CombinedL1;
  userAddedAddresses: `0x${string}`[];
}

export interface DiscoveryResult {
  candidates: `0x${string}`[];
  /** Subset of candidates with a known bridge counterparty, for badges. */
  bridgeHints: Map<`0x${string}`, BridgeRouteHint>;
}

/**
 * Merge the three discovery streams (API-derived ICTT addresses, L1
 * metadata, user-added localStorage entries) into a single deduped
 * candidate list. The hook handles the on-chain validation step.
 */
export function mergeCandidates({ apiAddresses, l1, userAddedAddresses }: DiscoveryInput): DiscoveryResult {
  const candidates = dedupeAddresses([
    ...extractKnownCandidates(l1),
    ...apiAddresses,
    ...userAddedAddresses,
  ]);

  // Bridge hints are populated as the UI fetches richer transfer detail
  // (not in this minimal merge). Returned empty for now; future passes
  // can hydrate it from the same `/api/l1-tokens/discover` response if
  // we extend the route to return route-level metadata.
  const bridgeHints = new Map<`0x${string}`, BridgeRouteHint>();

  return { candidates, bridgeHints };
}
