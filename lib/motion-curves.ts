/**
 * The hub's motion curves for JS (framer-motion `ease`, WAAPI `easing` through cssEase). The CSS tokens
 * --ease-out, --ease-in-out and --ease-drawer in app/global.css hold the same numbers, and
 * tests/unit/motion/foundation.test.ts keeps the two equal.
 */

/** Entrances and hover feedback: moves at once, then settles. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Movement from one place on screen to another: a clear acceleration and settle. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Sheets and drawers. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** A curve as a CSS timing function: `cubic-bezier(a, b, c, d)`. */
export function cssEase(curve: readonly [number, number, number, number]): string {
  return `cubic-bezier(${curve.join(', ')})`;
}
