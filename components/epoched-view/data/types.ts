/** A rising staircase in normalized plot coordinates (x and y in [0, 1]). */
export interface Stair {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly steps: number;
}

/** The height the L1's tip embeds (ink line; red while stale). */
export interface ViewSeries {
  readonly stair: Stair;
  /** Extend flat from the stair's end to this x (the freeze). */
  readonly flatTo?: number;
  /** The unlocking block: step up at atX to toY, then track to endY at x=1. */
  readonly jump?: { readonly atX: number; readonly toY: number; readonly endY: number };
  /** Series renders alarm-red from this x onward. */
  readonly alarmFrom?: number;
  /** Series renders healed (ink) again from this x onward. */
  readonly healFrom?: number;
  /** Block ticks (produced blocks) along the series, normalized x. */
  readonly blocks: readonly number[];
  /** Skipped proposer slots along the frozen line, normalized x. */
  readonly skips?: readonly number[];
}

/** The live P-Chain height series (steel staircase, above the view). */
export interface FigurePChain {
  readonly stair: Stair;
  /** RegisterL1ValidatorTx landing on the live registry, normalized x (y sits on the stair). */
  readonly registrationAt?: number;
}

/** The one red dimension between the series over the frozen span. */
export interface FigureDim {
  readonly atX: number;
  readonly label: string;
  readonly labelMobile: string;
}

/** One phase word under the axis; phases tile [0, 1] in order. */
export interface FigurePhase {
  readonly to: number;
  readonly label: string;
  readonly tone: "ok" | "alarm";
}

/** Everything the staircase figure draws. */
export interface FigureData {
  readonly pchain: FigurePChain;
  readonly view: ViewSeries;
  readonly dim: FigureDim;
  readonly phases: readonly FigurePhase[];
}
