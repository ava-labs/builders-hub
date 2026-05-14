// Per-user, per-L1 list of "watch this token" contract addresses. Stored
// in localStorage so it survives page reloads without backend work.
// Scoped by `(chainId, userAddress)` so two wallets sharing a browser
// don't see each other's custom token lists.
//
// The wallet's lowercase EVM address is the user identifier — wallets
// connecting to the same chain with different keypairs produce isolated
// lists. We don't try to recognize "same identity across chains" because
// custom-token lists are intrinsically chain-scoped anyway.

import { normalizeAddress } from './token-discovery';

const STORAGE_PREFIX = 'myL1.tokens';

function storageKey(chainId: number | null, userAddress: string): string | null {
  if (chainId === null) return null;
  const normalizedUser = normalizeAddress(userAddress);
  if (!normalizedUser) return null;
  return `${STORAGE_PREFIX}.${chainId}.${normalizedUser}`;
}

function readList(key: string): `0x${string}`[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: `0x${string}`[] = [];
    for (const value of parsed) {
      const addr = typeof value === 'string' ? normalizeAddress(value) : null;
      if (addr) cleaned.push(addr);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function writeList(key: string, addresses: `0x${string}`[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(addresses));
  } catch {
    // Quota exceeded, private-mode Safari, etc. — we degrade silently.
    // The UI keeps the optimistic update for this session; reload will
    // simply lose the additions.
  }
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
): `0x${string}`[] | null {
  const key = storageKey(chainId, userAddress);
  if (!key) return null;
  const token = normalizeAddress(tokenAddress);
  if (!token) return null;

  const current = readList(key);
  if (current.includes(token)) return current;
  const next = [...current, token];
  writeList(key, next);
  return next;
}

export function removeUserToken(
  chainId: number | null,
  userAddress: string,
  tokenAddress: string,
): `0x${string}`[] | null {
  const key = storageKey(chainId, userAddress);
  if (!key) return null;
  const token = normalizeAddress(tokenAddress);
  if (!token) return null;

  const current = readList(key);
  const next = current.filter((a) => a !== token);
  if (next.length === current.length) return current;
  writeList(key, next);
  return next;
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
