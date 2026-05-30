'use client';

import {
  CHART_PALETTES,
  DEFAULT_PALETTE_NAME,
  findPalette,
  type ChartPalette,
} from '@/lib/console/palettes';
import { createLocalPref } from '@/lib/console/local-pref';

const palettePref = createLocalPref<string>({
  key: 'console:my-l1:palette',
  changedEvent: 'console:my-l1:palette-changed',
  defaultValue: DEFAULT_PALETTE_NAME,
  parse: (raw) => (raw.length > 0 ? raw : undefined),
  serialize: (name) => name,
});

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
 * localStorage-backed chart palette selection. Default is Avalanche Red
 * so existing users see no visual change when this lands.
 *
 * Storage shape: a single string — the palette name. Anything malformed
 * → fall back to the default.
 */
export function useChartPalette(): UseChartPalette {
  const { value: paletteName, setValue, isHydrated } = palettePref.usePref();

  // Validate the name resolves to a known palette before persisting —
  // `findPalette` snaps unknown names to the default, so the persisted
  // value always matches a real preset.
  const setPalette = (name: string) => setValue(findPalette(name).name);

  return {
    palette: findPalette(paletteName),
    setPalette,
    presets: CHART_PALETTES,
    isHydrated,
  };
}
