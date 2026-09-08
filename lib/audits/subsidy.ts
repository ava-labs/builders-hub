// Subsidy math, pure and shared: the admin worksheet previews the split live
// and the decide endpoint stores the same numbers, so both must come from
// this one function.

export const SUBSIDY_MAX_PCT = 75;
// Slider step in the admin worksheet (1 so figures like 56% are reachable;
// Federico 2026-07-30, superseding the boards' step 5). The server enforces
// only the 0..75 cap; the step is a UI affordance, not a rule.
export const SUBSIDY_PCT_STEP = 1;

export interface SubsidySplit {
  program_amount_usd: number;
  project_amount_usd: number;
}

/**
 * Split a quote price between the program and the project at the approved
 * percentage. Whole dollars: the program share rounds to the nearest dollar
 * and the project keeps the exact remainder, so the parts always sum to the
 * price.
 */
export function computeSubsidySplit(priceUsd: number, pct: number): SubsidySplit {
  const program_amount_usd = Math.round((priceUsd * pct) / 100);
  return {
    program_amount_usd,
    project_amount_usd: priceUsd - program_amount_usd,
  };
}
