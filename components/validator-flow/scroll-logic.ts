/** Map track scroll progress (0..1) to the active step index. */
export function progressToStepIndex(progress: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(stepCount - 1, Math.max(0, Math.floor(progress * stepCount)));
}

/** Fraction of the track's scrollable height where a beat starts; used by rail jumps. */
export function beatStartFraction(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const clamped = Math.min(stepCount - 1, Math.max(0, index));
  return clamped / stepCount;
}
