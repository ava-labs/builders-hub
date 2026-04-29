'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme as useSiteTheme } from 'next-themes';

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

const STORAGE_KEY = 'console:my-l1:chart-theme';
const THEME_CHANGED_EVENT = 'console:my-l1:chart-theme-changed';

const VALID_THEMES: ReadonlySet<ChartTheme> = new Set(['auto', 'light', 'dark', 'rich']);

function isValidTheme(value: unknown): value is ChartTheme {
  return typeof value === 'string' && VALID_THEMES.has(value as ChartTheme);
}

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
  const { resolvedTheme: siteResolvedTheme } = useSiteTheme();
  const [theme, setThemeState] = useState<ChartTheme>('auto');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (isValidTheme(stored)) {
          setThemeState(stored);
        }
      } catch {
        // localStorage may be disabled — keep the default.
      }
    };

    sync();
    setIsHydrated(true);

    window.addEventListener(THEME_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTheme = useCallback((next: ChartTheme) => {
    if (!isValidTheme(next)) return;
    setThemeState(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — UI state still updates even if persistence fails
    }
    window.setTimeout(() => {
      window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
    }, 0);
  }, []);

  // Resolve `auto` against next-themes. Site dark prefers `rich` (the
  // elevated surface that matches the dashboard chrome) over `dark` (a
  // flatter near-black) since `rich` is what the rest of the dashboard
  // already uses; flipping to flat dark cards on dark mode looked off.
  const resolved: ResolvedChartTheme =
    theme === 'auto'
      ? siteResolvedTheme === 'light'
        ? 'light'
        : 'rich'
      : theme;

  return {
    theme,
    resolvedTheme: resolved,
    styles: CHART_THEME_STYLES[resolved],
    setTheme,
    isHydrated,
  };
}
