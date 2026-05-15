// Per-user, per-L1 list of "watch this token" contract addresses. Scoped
// by `(chainId, userAddress)` so two wallets sharing a browser don't see
// each other's custom token lists.
//
// Storage strategy: a module-level Map is the session source of truth.
// localStorage is a best-effort write-through cache for cross-session
// persistence. Reads consult the Map (which hydrates from localStorage
// once per key on first access); writes update the Map unconditionally
// and try to mirror to localStorage. This matters because some browser
// modes (Safari private, quota-exceeded) reject `setItem` — if we let
// the failure swallow the update, the next pipeline refresh would re-
// read the stale list and the just-added token would vanish despite
// the dialog reporting success. With the Map as source of truth, the
// token stays for the session even when persistence fails; the user
// is told the persistence outcome so they know whether it'll survive
// a reload.
//
// The wallet's lowercase EVM address is the user identifier — wallets
// connecting to the same chain with different keypairs produce isolated
// lists. We don't try to recognize "same identity across chains" because
// custom-token lists are intrinsically chain-scoped anyway.

import { normalizeAddress } from './token-discovery';

const STORAGE_PREFIX = 'myL1.tokens';

// Module-level state. Reset only on page reload.
const memoryCache = new Map<string, `0x${string}`[]>();
// Tracks which keys' most recent write attempt failed to persist. Used
// by `getPersistenceStatus` so the UI can warn users that their additions
// won't survive a reload.
const persistenceFailed = new Set<string>();
// Tracks which keys have ever attempted a write this session, so
// `getPersistenceStatus` can distinguish "not yet attempted" from
// "succeeded".
const persistenceAttempted = new Set<string>();

function storageKey(chainId: number | null, userAddress: string): string | null {
  if (chainId === null) return null;
  const normalizedUser = normalizeAddress(userAddress);
  if (!normalizedUser) return null;
  return `${STORAGE_PREFIX}.${chainId}.${normalizedUser}`;
}

/**
 * Returns a defensive copy of the current list for the key, hydrating
 * from localStorage on first access. Always reads from the in-memory
 * map after first hydration — this is what makes a `refresh()` right
 * after `addUserToken` see the new entry even when `setItem` failed.
 */
function readList(key: string): `0x${string}`[] {
  const cached = memoryCache.get(key);
  if (cached) return cached.slice();

  if (typeof window === 'undefined') {
    memoryCache.set(key, []);
    return [];
  }

  let hydrated: `0x${string}`[] = [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          const addr = typeof value === 'string' ? normalizeAddress(value) : null;
          if (addr) hydrated.push(addr);
        }
      }
    }
  } catch {
    hydrated = [];
  }

  memoryCache.set(key, hydrated);
  return hydrated.slice();
}

/**
 * Updates both the in-memory map (always succeeds) and localStorage
 * (best effort). Returns whether the localStorage write succeeded so
 * callers can surface the outcome.
 */
function writeList(key: string, addresses: `0x${string}`[]): { persisted: boolean } {
  // Store a defensive copy so external mutation of the returned array
  // can't reach into the cache.
  memoryCache.set(key, addresses.slice());

  if (typeof window === 'undefined') {
    persistenceAttempted.add(key);
    persistenceFailed.add(key);
    return { persisted: false };
  }

  persistenceAttempted.add(key);
  try {
    window.localStorage.setItem(key, JSON.stringify(addresses));
    persistenceFailed.delete(key);
    return { persisted: true };
  } catch {
    // Quota exceeded, private-mode Safari, etc. The Map already has the
    // update so the session keeps working; the flag lets the UI tell
    // the user persistence is off.
    persistenceFailed.add(key);
    return { persisted: false };
  }
}

export interface MutationResult {
  addresses: `0x${string}`[];
  /** True when the new list was successfully written to localStorage.
   *  False when the write was rejected (private-mode Safari, quota
   *  exceeded, SSR). The Map is updated either way — the entry stays
   *  visible for this session — but `false` means it won't survive a
   *  page reload. */
  persisted: boolean;
}

export function getUserTokens(chainId: number | null, userAddress: string): `0x${string}`[] {
  const key = storageKey(chainId, userAddress);
  if (!key) return [];
  return readList(key);
}

export function addUserToken(
  chainId: number | null,
  userAddress: string,
  tokenAddress: string,
): MutationResult | null {
  const key = storageKey(chainId, userAddress);
  if (!key) return null;
  const token = normalizeAddress(tokenAddress);
  if (!token) return null;

  const current = readList(key);
  if (current.includes(token)) {
    return {
      addresses: current,
      // Already-present means we didn't attempt a write this call, but
      // we still want to report a truthful current state for the badge.
      // Surface `false` if a prior write for this key failed.
      persisted: !persistenceFailed.has(key),
    };
  }
  const next = [...current, token];
  const { persisted } = writeList(key, next);
  return { addresses: next, persisted };
}

export function removeUserToken(
  chainId: number | null,
  userAddress: string,
  tokenAddress: string,
): MutationResult | null {
  const key = storageKey(chainId, userAddress);
  if (!key) return null;
  const token = normalizeAddress(tokenAddress);
  if (!token) return null;

  const current = readList(key);
  const next = current.filter((a) => a !== token);
  if (next.length === current.length) {
    return { addresses: current, persisted: !persistenceFailed.has(key) };
  }
  const { persisted } = writeList(key, next);
  return { addresses: next, persisted };
}

/** Returns true if the address is already in the user's saved list for
 *  this (chain, user). Useful for the AddTokenDialog's duplicate-check
 *  UX so we can short-circuit before validating on-chain. */
export function hasUserToken(
  chainId: number | null,
  userAddress: string,
  tokenAddress: string,
): boolean {
  const key = storageKey(chainId, userAddress);
  if (!key) return false;
  const token = normalizeAddress(tokenAddress);
  if (!token) return false;
  return readList(key).includes(token);
}

/** Reports whether the most recent mutation to this (chain, user)'s
 *  list persisted to localStorage. Returns:
 *    - `'ok'`       — last write succeeded (or no write attempted yet,
 *                     but a hydrated cache entry exists).
 *    - `'failed'`   — last write attempt was rejected (private mode,
 *                     quota, etc.); session-only entries will be lost
 *                     on reload.
 *    - `'unknown'`  — no write has been attempted and nothing is
 *                     hydrated for this key (effectively a fresh state).
 */
export function getPersistenceStatus(
  chainId: number | null,
  userAddress: string,
): 'ok' | 'failed' | 'unknown' {
  const key = storageKey(chainId, userAddress);
  if (!key) return 'unknown';
  if (persistenceFailed.has(key)) return 'failed';
  if (persistenceAttempted.has(key)) return 'ok';
  return memoryCache.has(key) ? 'ok' : 'unknown';
}
