import type { Variants, Transition } from 'framer-motion';

// SPRING_TIGHT for dense grids; SPRING_SOFT for hero+body chrome. Stiffness
// drifted between 200 and 240 across five inline copies — these two presets
// preserve both feels intentionally instead of averaging them away.
const SPRING_TIGHT: Transition = { type: 'spring', stiffness: 240, damping: 22 };
const SPRING_SOFT: Transition = { type: 'spring', stiffness: 200, damping: 24 };

export const boardContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

export const boardItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING_TIGHT },
};

export const sectionContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export const sectionItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING_SOFT },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/**
 * con-press: the console's buttons press in under the finger. Colours, the hover shadow and gradient stops keep their
 * 150ms on Tailwind's default curve; the press takes 160ms on the strong ease-out. Tailwind's scale-* utilities set the
 * CSS `scale` property, so the list names `scale`. A control takes this in place of its own transition classes: one
 * transition list per element, so a second one would fight it.
 */
export const PRESS_TRANSITION =
  '[transition:color_150ms_var(--default-transition-timing-function),background-color_150ms_var(--default-transition-timing-function),border-color_150ms_var(--default-transition-timing-function),box-shadow_150ms_var(--default-transition-timing-function),--tw-gradient-from_150ms_var(--default-transition-timing-function),--tw-gradient-via_150ms_var(--default-transition-timing-function),--tw-gradient-to_150ms_var(--default-transition-timing-function),scale_160ms_var(--ease-out)]';

/** Held down, a control dips to 97%. Under Reduce Motion it dims to 85% instead of shrinking. */
export const PRESS = 'active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:active:opacity-85';

/** A full-width button dips to 98%, so its edges do not jump. */
export const PRESS_WIDE = 'active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:active:opacity-85';
