'use client';

import { useCallback, useEffect, useState } from 'react';

export type ChartTheme = 'light' | 'dark' | 'rich';

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

export const CHART_THEME_STYLES: Record<ChartTheme, ChartThemeStyles> = {
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

const VALID_THEMES: ReadonlySet<ChartTheme> = new Set(['light', 'dark', 'rich']);

function isValidTheme(value: unknown): value is ChartTheme {
  return typeof value === 'string' && VALID_THEMES.has(value as ChartTheme);
}

export interface UseChartTheme {
  theme: ChartTheme;
  styles: ChartThemeStyles;
  setTheme: (theme: ChartTheme) => void;
  isHydrated: boolean;
}

/**
 * localStorage-backed chart-card theme selector. Independent from the app's
 * light/dark mode — users may want elevated "rich" cards on a dark page,
 * or pure light cards on a dark page when capturing screenshots for a
 * light-themed deck. Default is `rich` to match the Image Studio look the
 * dashboard adopts by default.
 *
 * Storage shape: a single string — one of 'light' | 'dark' | 'rich'.
 * Anything else → fall back to 'rich'.
 */
export function useChartTheme(): UseChartTheme {
  const [theme, setThemeState] = useState<ChartTheme>('rich');
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

  return {
    theme,
    styles: CHART_THEME_STYLES[theme],
    setTheme,
    isHydrated,
  };
}
