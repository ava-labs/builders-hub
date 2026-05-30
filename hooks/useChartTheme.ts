'use client';

import { useTheme as useSiteTheme } from '@/components/content-design/theme-observer';
import { createLocalPref } from '@/lib/console/local-pref';

// User-facing chart-theme choice.
//   `auto`        → follow the Builder Hub site's light/dark mode (default).
//   `light/dark`  → force a flat surface regardless of site theme.
//   `rich`        → elevated dark surface (Image Studio look) regardless of site theme.
export type ChartTheme = 'auto' | 'light' | 'dark' | 'rich';

// The actual rendered look. `auto` resolves to one of these at hook time;
// the rest of the codebase only ever sees a concrete style.
type ResolvedChartTheme = Exclude<ChartTheme, 'auto'>;

export interface ChartThemeStyles {
  /** Tailwind classes applied to each chart card. Includes background,
   *  border, text, and elevation effects appropriate for the theme. */
  cardClass: string;
  /** Hex color used by Recharts for axis tick labels. Picked for
   *  contrast on the theme's card background. */
  axisTickColor: string;
  /** Hex color used by Recharts for cartesian grid lines. */
  gridStroke: string;
  /** Active-dot stroke (the small ring drawn around the hovered point). */
  activeDotStroke: string;
}

export const CHART_THEME_STYLES: Record<ResolvedChartTheme, ChartThemeStyles> = {
  light: {
    cardClass:
      'bg-zinc-50 border border-zinc-200 text-zinc-950 rounded-xl shadow-sm shadow-black/[0.03]',
    axisTickColor: '#52525b', // zinc-600 — readable on light surface
    gridStroke: '#71717a', // zinc-500
    activeDotStroke: '#ffffff',
  },
  dark: {
    cardClass:
      'bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl shadow-sm shadow-black/40',
    axisTickColor: '#a1a1aa', // zinc-400
    gridStroke: '#71717a', // zinc-500
    activeDotStroke: '#0a0a0a',
  },
  rich: {
    cardClass:
      'bg-zinc-900 border border-zinc-700/50 text-zinc-100 rounded-xl shadow-sm shadow-black/40 ring-1 ring-inset ring-white/[0.02]',
    axisTickColor: '#a1a1aa', // zinc-400
    gridStroke: '#71717a', // zinc-500
    activeDotStroke: '#18181b',
  },
};

const VALID_THEMES: ReadonlySet<ChartTheme> = new Set(['auto', 'light', 'dark', 'rich']);

function isValidTheme(value: unknown): value is ChartTheme {
  return typeof value === 'string' && VALID_THEMES.has(value as ChartTheme);
}

const themePref = createLocalPref<ChartTheme>({
  key: 'console:my-l1:chart-theme',
  changedEvent: 'console:my-l1:chart-theme-changed',
  defaultValue: 'auto',
  parse: (raw) => (isValidTheme(raw) ? raw : undefined),
  serialize: (theme) => theme,
});

export interface UseChartTheme {
  /** The user's preference (`auto` by default). */
  theme: ChartTheme;
  /** The currently-rendered theme — `auto` resolved against the site theme. */
  resolvedTheme: ResolvedChartTheme;
  styles: ChartThemeStyles;
  setTheme: (theme: ChartTheme) => void;
  isHydrated: boolean;
}

/**
 * localStorage-backed chart-card theme selector that follows the Builder Hub
 * site theme by default, with optional manual overrides.
 *
 * Resolution:
 *   - `auto` (default): site light → `light`; site dark → `rich` (the
 *     elevated dark surface that matches the rest of the dashboard chrome).
 *   - `light` / `dark` / `rich`: override the site theme entirely. Useful
 *     when capturing chart screenshots for a deck whose theme differs from
 *     the user's current site preference.
 *
 * Storage shape: a single string — one of 'auto' | 'light' | 'dark' | 'rich'.
 * Legacy values are accepted; anything else falls back to 'auto'.
 */
export function useChartTheme(): UseChartTheme {
  // The project doesn't wrap the app in next-themes — it uses its own
  // MutationObserver-based ThemeProvider that returns 'light' | 'dark'
  // by watching the `dark` class on <html>. Using next-themes here gave
  // `undefined` on every render, which silently fell through to 'rich'
  // and made `auto` look identical to the old default in light mode.
  const siteTheme = useSiteTheme();
  const { value: theme, setValue, isHydrated } = themePref.usePref();

  // Reject unknown values at the call site so callers can't poke a
  // malformed theme into storage.
  const setTheme = (next: ChartTheme) => {
    if (!isValidTheme(next)) return;
    setValue(next);
  };

  // `auto` mirrors the site theme one-to-one: light → light, dark → dark.
  // The `rich` preset stays available as a manual override via the picker
  // for users who want the elevated dark surface regardless of site theme.
  const resolved: ResolvedChartTheme =
    theme === 'auto' ? (siteTheme === 'light' ? 'light' : 'dark') : theme;

  return {
    theme,
    resolvedTheme: resolved,
    styles: CHART_THEME_STYLES[resolved],
    setTheme,
    isHydrated,
  };
}
