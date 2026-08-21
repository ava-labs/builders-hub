import type { FigureData } from "./types";

/**
 * The stamped round-3.2 full-arc figure: one incident, start to finish.
 * Numbers and phases mirror the worked-example table on the ProposerVM page
 * (healthy, frozen 42 days, healed by one block); all numbers illustrative.
 */
export const staleViewFigure: FigureData = {
  pchain: {
    stair: { x0: 0, y0: 0.3, x1: 1, y1: 0.92, steps: 13 },
    registrationAt: 0.56,
  },
  view: {
    stair: { x0: 0.02, y0: 0.26, x1: 0.22, y1: 0.36, steps: 3 },
    flatTo: 0.62,
    jump: { atX: 0.62, toY: 0.62, endY: 0.82 },
    alarmFrom: 0.22,
    healFrom: 0.62,
    blocks: [0.07, 0.145, 0.22, 0.62, 0.78, 0.94],
    skips: [0.3, 0.38, 0.46, 0.54],
  },
  dim: { atX: 0.42, label: "42 DAYS BEHIND", labelMobile: "42 DAYS" },
  phases: [
    { to: 0.22, label: "HEALTHY", tone: "ok" },
    { to: 0.62, label: "FROZEN", tone: "alarm" },
    { to: 1, label: "HEALED", tone: "ok" },
  ],
};
