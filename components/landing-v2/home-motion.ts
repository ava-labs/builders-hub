import { EASE_OUT } from "@/lib/motion-curves";

/**
 * The home's motion values (components/landing-v2/StoryHome.tsx). The hero copy's entrance is CSS (.hero-enter in
 * app/global.css), so it plays from the first frame; these are the framer-motion values after hydration.
 */

// home-hero-word: one roll. The next noun enters in 320ms while the last leaves in 240ms, so the slot is never half
// empty and the exit is the faster of the two; both are blurred 2px while they cross, so the two read as one roll.
// At rest the blur is dropped (filter none), so the noun renders like the rest of the headline.
export const NOUN_ROLL = {
  initial: { y: "100%", filter: "blur(2px)" },
  animate: {
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.32, ease: EASE_OUT },
    transitionEnd: { filter: "none" },
  },
  exit: { y: "-100%", filter: "blur(2px)", transition: { duration: 0.24, ease: EASE_OUT } },
} as const;

/** The noun slot's width settles with the roll, not after it. */
export const NOUN_WIDTH = "width 320ms var(--ease-out)";

// The red full stop confirms each word once: it waits raised 0.16em at 30% opacity, then drops into place in 260ms
// as the word lands, and holds still (a loop with no pause control fails WCAG 2.2.2).
export const STOP_DROP = {
  initial: { opacity: 0.3, y: "-0.16em" },
  animate: { opacity: 1, y: "0em" },
  transition: { duration: 0.26, delay: 0.22, ease: EASE_OUT },
} as const;

// home-board-arrival: the board is in place at once; its rows settle 8px in 300ms, 50ms apart, so the whole board
// is in place in under half a second.
export const BOARD_VARIANTS = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
export const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};
// Reduced motion: the rows keep the hidden start the server sent (a different start would not hydrate) and show at
// once, with no cascade
export const BOARD_STATIC = { hidden: {}, show: { transition: { staggerChildren: 0 } } };
export const ROW_STATIC = { hidden: ROW_VARIANTS.hidden, show: { opacity: 1, y: 0, transition: { duration: 0 } } };

/** The stats heading settles like the chapter titles below it: 8px in 400ms. */
export const HEADING_RISE = { initial: { opacity: 0, y: 8 }, transition: { duration: 0.4, ease: EASE_OUT } };

/** A ledger figure counts only its last 6%, in 600ms: the reader sees the real magnitude at once. */
export const COUNT_FROM = 0.94;
export const COUNT = { duration: 0.6, ease: EASE_OUT };
