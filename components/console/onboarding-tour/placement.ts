import type { TourStep } from "./types";

/** Where the spotlight and card sit: the step that was measured, its target's rect, and whether to travel there. */
export interface Placement {
  step: TourStep;
  rect: DOMRect;
  glide: boolean;
}

/**
 * con-tour-glide: what moves the spotlight and card.
 * - "stop": the tour moved on and measured its next stop. The first stop is placed at once; each later one is
 *   travelled to.
 * - "track": a scroll, a resize or the settle after a scroll into view. Placed at once: a 350ms lag would trail the
 *   target.
 * - "close": the tour closed. It forgets its place, so the next start places its first stop at once instead of
 *   travelling from the last one.
 */
export type PlacementEvent =
  | { kind: "stop"; step: TourStep; rect: DOMRect }
  | { kind: "track"; step: TourStep; rect: DOMRect }
  | { kind: "close" };

export function nextPlacement(previous: Placement | null, event: PlacementEvent): Placement | null {
  if (event.kind === "close") return null;
  return { step: event.step, rect: event.rect, glide: event.kind === "stop" && previous !== null };
}
