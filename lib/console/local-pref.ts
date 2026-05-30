'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Shared `localStorage`-backed preference primitive for the console.
 *
 * Several console hooks (`useFavoriteTools`, `useSubStepSearchToggle`,
 * `useChartPalette`, `useChartTheme`) reimplemented the same handful of
 * boilerplate steps:
 *   - SSR-safe read on mount, default value when window is undefined
 *   - `isHydrated` flag to gate UI from SSR/CSR mismatch
 *   - Custom `window` event so other tabs and other instances of the same
 *     hook in the SAME tab pick up writes (Storage event only fires
 *     cross-tab; same-tab listeners need a manual dispatch)
 *   - `storage` event listener for cross-tab sync
 *   - try/catch around every localStorage call (private-browsing mode and
 *     denied-permission throw on access)
 *
 * `createLocalPref` collapses all of that into one factory. Each hook
 * supplies a `key`, `changedEvent`, default, and parse/serialize pair,
 * and gets back a `usePref()` hook that returns `{ value, setValue,
 * isHydrated }`. Hook-specific surface (e.g. `useFavoriteTools.toggle`)
 * is built on top.
 */
export interface LocalPrefOptions<T> {
  /** localStorage key. */
  key: string;
  /** Window event name dispatched on writes. Same-tab listeners and
   *  cross-tab listeners both react to it (cross-tab via the native
   *  `storage` event, same-tab via this manual dispatch). */
  changedEvent: string;
  /** Returned when nothing is persisted, or when the persisted value
   *  fails to parse. */
  defaultValue: T;
  /** Parse the raw stored string into T. Return `undefined` to fall
   *  back to `defaultValue` (e.g. for malformed JSON, bad enum values). */
  parse: (raw: string) => T | undefined;
  /** Serialize T into a string for localStorage. */
  serialize: (value: T) => string;
}

export interface UseLocalPref<T> {
  /** Current persisted value, or `defaultValue` until hydration runs. */
  value: T;
  /** Update the persisted value. Accepts a value or an updater
   *  function (mirrors `useState`'s setter). Persistence failures
   *  (private mode, full quota) are swallowed — in-memory state still
   *  updates so the UI doesn't appear stuck. */
  setValue: (next: T | ((prev: T) => T)) => void;
  /** True after the localStorage hydration effect has run. Gate any UI
   *  that should look identical on server and client first paint. */
  isHydrated: boolean;
}

export interface LocalPref<T> {
  /** React hook surface — returns the current value, a setter, and
   *  the hydration flag. */
  usePref: () => UseLocalPref<T>;
  /** SSR-safe synchronous read for callers outside React. Returns
   *  `defaultValue` on the server. */
  read: () => T;
}

export function createLocalPref<T>(options: LocalPrefOptions<T>): LocalPref<T> {
  const { key, changedEvent, defaultValue, parse, serialize } = options;

  function read(): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = parse(raw);
      return parsed === undefined ? defaultValue : parsed;
    } catch {
      return defaultValue;
    }
  }

  function emitChanged() {
    if (typeof window === 'undefined') return;
    // Async dispatch so subscribers get a fresh microtask to read state.
    // Without this, a setValue call inside an effect can re-enter the
    // same effect synchronously and trip "max update depth" warnings.
    window.setTimeout(() => window.dispatchEvent(new Event(changedEvent)), 0);
  }

  function usePref(): UseLocalPref<T> {
    const [value, setValueState] = useState<T>(defaultValue);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const sync = () => setValueState(read());
      sync();
      setIsHydrated(true);
      window.addEventListener(changedEvent, sync);
      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener(changedEvent, sync);
        window.removeEventListener('storage', sync);
      };
      // `read`, `changedEvent` are closed over from the outer factory call
      // and never change — we deliberately omit them from deps so the
      // effect runs once per mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setValue = useCallback((next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved =
          typeof next === 'function'
            ? (next as (prev: T) => T)(prev)
            : next;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, serialize(resolved));
          } catch {
            // Persistence may fail (denied permission, full quota). Local
            // state still updates so the UI continues to track the user's
            // intent, even if it won't survive a reload.
          }
          emitChanged();
        }
        return resolved;
      });
    }, []);

    return { value, setValue, isHydrated };
  }

  return { usePref, read };
}
