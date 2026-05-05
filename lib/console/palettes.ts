// Palette presets shared across console chart surfaces. Ported from the
// dApp Stats dashboard's `lib/rwa/constants/palettes.ts` (PR #4093) so the
// two surfaces stay visually compatible. Avalanche Red is the default —
// matches the existing My L1 chart accent so existing screenshots keep
// reading the same.
//
// Each palette ships seven shades (300–900) so both filled (line / bar)
// and outlined (gradient / hover) chart elements have headroom to render
// distinct visual layers without recomputing colors at the call site.

export interface ChartPalette {
  /** Display name shown in the picker popover. Stable string used as the
   *  localStorage key, so renaming requires a migration. */
  name: string;
  shades: {
    900: string;
    800: string;
    700: string;
    600: string;
    500: string;
    400: string;
    300: string;
  };
}

export const CHART_PALETTES: ChartPalette[] = [
  {
    name: 'Avalanche',
    shades: {
      900: '#7a0e10',
      800: '#9c1414',
      700: '#c01818',
      600: '#d62525',
      500: '#e84142',
      400: '#f06b6c',
      300: '#f59999',
    },
  },
  {
    name: 'Indigo',
    shades: {
      900: '#312e81',
      800: '#3730a3',
      700: '#4338ca',
      600: '#4f46e5',
      500: '#6366f1',
      400: '#818cf8',
      300: '#a5b4fc',
    },
  },
  {
    name: 'Violet',
    shades: {
      900: '#4c1d95',
      800: '#5b21b6',
      700: '#6d28d9',
      600: '#7c3aed',
      500: '#8b5cf6',
      400: '#a78bfa',
      300: '#c4b5fd',
    },
  },
  {
    name: 'Blue',
    shades: {
      900: '#1e3a5f',
      800: '#1e40af',
      700: '#1d4ed8',
      600: '#2563eb',
      500: '#3b82f6',
      400: '#60a5fa',
      300: '#93c5fd',
    },
  },
  {
    name: 'Emerald',
    shades: {
      900: '#064e3b',
      800: '#065f46',
      700: '#047857',
      600: '#059669',
      500: '#10b981',
      400: '#34d399',
      300: '#6ee7b7',
    },
  },
  {
    name: 'Rose',
    shades: {
      900: '#881337',
      800: '#9f1239',
      700: '#be123c',
      600: '#e11d48',
      500: '#f43f5e',
      400: '#fb7185',
      300: '#fda4af',
    },
  },
  {
    name: 'Amber',
    shades: {
      900: '#78350f',
      800: '#92400e',
      700: '#b45309',
      600: '#d97706',
      500: '#f59e0b',
      400: '#fbbf24',
      300: '#fcd34d',
    },
  },
];

/** Palette used when localStorage is empty / unreadable / contains a name
 *  that no longer exists in CHART_PALETTES. */
export const DEFAULT_PALETTE_NAME = 'Avalanche';

export function findPalette(name: string | null | undefined): ChartPalette {
  if (!name) return CHART_PALETTES[0];
  return CHART_PALETTES.find((p) => p.name === name) ?? CHART_PALETTES[0];
}
