'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme as useSiteTheme } from '@/components/content-design/theme-observer';

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
// Bumped once when the default flipped from `rich` to `auto`. On first
// sync after the bump we flip any user who was sitting on the old
// `rich` default to `auto` so they get the follow-site-theme behaviour
// without having to discover the picker. Users who actively pick a
// theme afterwards keep their pick (the migration only runs once).
const MIGRATION_KEY = 'console:my-l1:chart-theme:migrated';
const CURRENT_MIGRATION_VERSION = '2026-04-29-auto-default';

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
  // The project doesn't wrap the app in next-themes — it uses its own
  // MutationObserver-based ThemeProvider that returns 'light' | 'dark'
  // by watching the `dark` class on <html>. Using next-themes here gave
  // `undefined` on every render, which silently fell through to 'rich'
  // and made `auto` look identical to the old default in light mode.
  const siteTheme = useSiteTheme();
  const [theme, setThemeState] = useState<ChartTheme>('auto');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      try {
        // One-shot migration. Pre-`auto`, every user defaulted to `rich`
        // and most never opened the picker — leaving them on a forced
        // dark surface even when their site theme is light. Flip those
        // users to `auto` once. The migration version key isolates this
        // from any future migration.
        const migrationDone =
          window.localStorage.getItem(MIGRATION_KEY) === CURRENT_MIGRATION_VERSION;
        if (!migrationDone) {
          const previous = window.localStorage.getItem(STORAGE_KEY);
          if (previous === 'rich') {
            window.localStorage.setItem(STORAGE_KEY, 'auto');
          }
          window.localStorage.setItem(MIGRATION_KEY, CURRENT_MIGRATION_VERSION);
        }

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
