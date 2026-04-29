'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CHART_PALETTES,
  DEFAULT_PALETTE_NAME,
  findPalette,
  type ChartPalette,
} from '@/lib/console/palettes';

const STORAGE_KEY = 'console:my-l1:palette';
const PALETTE_CHANGED_EVENT = 'console:my-l1:palette-changed';

export interface UseChartPalette {
  /** Currently active palette. Always a valid object; falls back to the
   *  default when nothing's persisted yet. */
  palette: ChartPalette;
  /** Persists a new selection by name. Looks up the matching palette;
   *  no-ops on unknown names rather than throwing. */
  setPalette: (name: string) => void;
  /** Stable list of preset palettes for rendering the picker. Re-exported
   *  from the constants module so callers don't need a separate import. */
  presets: ChartPalette[];
  /** True after the localStorage hydration effect has run. Gate any UI
   *  that should look identical on server and client first paint. */
  isHydrated: boolean;
}

/**
 * localStorage-backed chart palette selection. Mirrors the shape of
 * `useFavoriteTools` (same patterns: hydration flag, custom event for
 * cross-tab sync, no-op on SSR). Default is Avalanche Red so existing
 * users see no visual change when this lands.
 *
 * Storage shape: a single string — the palette name. Anything malformed
 * → fall back to the default.
 */
export function useChartPalette(): UseChartPalette {
  const [paletteName, setPaletteName] = useState<string>(DEFAULT_PALETTE_NAME);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && typeof stored === 'string') {
          setPaletteName(stored);
        }
      } catch {
        // localStorage may be disabled (private mode, denied permission).
        // Keep the in-memory default rather than crashing.
      }
    };

    sync();
    setIsHydrated(true);

    window.addEventListener(PALETTE_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(PALETTE_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setPalette = useCallback((name: string) => {
    // Validate the name resolves to a known palette before persisting.
    const resolved = findPalette(name);
    setPaletteName(resolved.name);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved.name);
    } catch {
      // ignore — UI state still updates even if persistence fails
    }
    // Async dispatch so subscribers get a fresh microtask to read state.
    window.setTimeout(() => {
      window.dispatchEvent(new Event(PALETTE_CHANGED_EVENT));
    }, 0);
  }, []);

  return {
    palette: findPalette(paletteName),
    setPalette,
    presets: CHART_PALETTES,
    isHydrated,
  };
}
