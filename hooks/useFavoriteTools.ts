'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'console:favorite-tools';
const FAVORITES_CHANGED_EVENT = 'console:favorite-tools-changed';

// Tools always pinned to the sidebar — the canonical navigation, not
// promotable/demotable by the user. Starring exists to lift OTHER toolbox
// tools into the sidebar; the mandatory list is the floor, not a default.
const MANDATORY_PATHS = new Set<string>([
  '/console',
  '/console/toolbox',
  '/console/create-l1',
  '/console/my-l1',
  '/console/primary-network/faucet',
  '/console/testnet-infra/nodes',
  '/console/testnet-infra/icm-relayer',
  '/console/primary-network/node-setup',
  '/console/primary-network/stake',
  '/console/primary-network/c-p-bridge',
  '/console/primary-network/validator-alerts',
  '/console/permissioned-l1s/add-validator',
  '/console/permissionless-l1s/stake/native',
  '/console/permissioned-l1s/disable-validator',
  '/console/icm/setup',
  '/console/ictt/setup',
  '/console/ictt/token-transfer',
  '/console/encrypted-erc/overview',
  '/console/encrypted-erc/deploy',
]);

function normalizeFavorites(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value.filter(
      (p): p is string =>
        typeof p === 'string' && p.length > 0 && !MANDATORY_PATHS.has(p),
    ),
  );
}

function readFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeFavorites(JSON.parse(stored)) : new Set();
  } catch {
    // localStorage may be disabled (private mode, denied permission) or the
    // stored value may be malformed. Start fresh rather than crashing.
    return new Set();
  }
}

function emitFavoritesChanged() {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  }, 0);
}

export interface UseFavoriteTools {
  /** True for any path that's either mandatory OR user-favorited. */
  isStarred: (path: string) => boolean;
  /** True only for paths the user explicitly starred (excludes mandatory). */
  isUserStarred: (path: string) => boolean;
  /** True for the canonical sidebar items the user can't unstar. */
  isMandatory: (path: string) => boolean;
  /** Toggle a path's user-starred state; no-op for mandatory paths. */
  toggle: (path: string) => void;
  /** Snapshot of paths the user has explicitly starred. */
  userStarred: string[];
  /** True after the localStorage hydration effect has run — gate any UI
   *  that should look identical on server and client first paint. */
  isHydrated: boolean;
}

/**
 * localStorage-backed favorite tools. Reads on mount, writes on every
 * toggle. Mandatory paths can't be removed because they're hardcoded into
 * the sidebar groups; the hook surfaces them as starred so the toolbox UI
 * can show the user "this one is already pinned for you" with the same
 * visual treatment as user-starred items.
 *
 * Storage shape: a JSON array of paths. Anything malformed → start fresh.
 */
export function useFavoriteTools(): UseFavoriteTools {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFavorites = () => setFavorites(readFavorites());

    syncFavorites();
    setIsHydrated(true);

    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    window.addEventListener('storage', syncFavorites);

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
      window.removeEventListener('storage', syncFavorites);
    };
  }, []);

  const persist = useCallback((next: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // ignore — UI state still updates even if persistence fails
    }
    emitFavoritesChanged();
  }, []);

  const toggle = useCallback(
    (path: string) => {
      if (MANDATORY_PATHS.has(path)) return;
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isStarred = useCallback(
    (path: string) => MANDATORY_PATHS.has(path) || favorites.has(path),
    [favorites],
  );

  const isUserStarred = useCallback((path: string) => favorites.has(path), [favorites]);

  const isMandatory = useCallback((path: string) => MANDATORY_PATHS.has(path), []);

  const userStarred = useMemo(() => Array.from(favorites), [favorites]);

  return {
    isStarred,
    isUserStarred,
    isMandatory,
    toggle,
    userStarred,
    isHydrated,
  };
}
