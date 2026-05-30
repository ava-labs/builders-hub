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
