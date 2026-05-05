'use client';

import { useCallback, useMemo } from 'react';
import { createLocalPref } from '@/lib/console/local-pref';

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

const favoritesPref = createLocalPref<Set<string>>({
  key: 'console:favorite-tools',
  changedEvent: 'console:favorite-tools-changed',
  defaultValue: new Set(),
  parse: (raw) => {
    try {
      return normalizeFavorites(JSON.parse(raw));
    } catch {
      // Malformed JSON — start fresh.
      return undefined;
    }
  },
  serialize: (favorites) => JSON.stringify(Array.from(favorites)),
});

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
 * localStorage-backed favorite tools. Mandatory paths can't be removed
 * because they're hardcoded into the sidebar groups; the hook surfaces
 * them as starred so the toolbox UI can show the user "this one is already
 * pinned for you" with the same visual treatment as user-starred items.
 *
 * Storage shape: a JSON array of paths. Anything malformed → start fresh.
 */
export function useFavoriteTools(): UseFavoriteTools {
  const { value: favorites, setValue, isHydrated } = favoritesPref.usePref();

  const toggle = useCallback(
    (path: string) => {
      if (MANDATORY_PATHS.has(path)) return;
      setValue((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [setValue],
  );

  const isStarred = useCallback(
    (path: string) => MANDATORY_PATHS.has(path) || favorites.has(path),
    [favorites],
  );

  const isUserStarred = useCallback(
    (path: string) => favorites.has(path),
    [favorites],
  );

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
