/* Helicon staking parameters */

export type HeliconNetwork = "mainnet" | "fuji";

/** Activation instant, epoch ms. */
export const HELICON_ACTIVATION: Record<HeliconNetwork, number> = {
  mainnet: Date.UTC(2026, 8, 22, 15, 0, 0), // Sep 22 2026, 11:00 AM ET
  fuji: Date.UTC(2026, 6, 28, 15, 0, 0), // Jul 28 2026
};

export function heliconActive(at: number, network: HeliconNetwork = "mainnet"): boolean {
  return at >= HELICON_ACTIVATION[network];
}

/* ---- ACP-285: MinConsumptionRate ---- */

export const MIN_CONSUMPTION_RATE_PRE = 0.1;
export const MIN_CONSUMPTION_RATE_POST = 0.075;
export const ACP285_RAMP_DAYS = 90;

/** The floor in effect at `at`, interpolated across the 90-day ramp. */
export function minConsumptionRateAt(at: number, network: HeliconNetwork = "mainnet"): number {
  const activation = HELICON_ACTIVATION[network];
  if (at < activation) return MIN_CONSUMPTION_RATE_PRE;
  const rampMs = ACP285_RAMP_DAYS * 86_400_000;
  const elapsed = at - activation;
  if (elapsed >= rampMs) return MIN_CONSUMPTION_RATE_POST;
  const drop = MIN_CONSUMPTION_RATE_PRE - MIN_CONSUMPTION_RATE_POST;
  return MIN_CONSUMPTION_RATE_PRE - drop * (elapsed / rampMs);
}

/* ---- ACP-267: uptime requirement ---- */

export const UPTIME_REQUIREMENT_PRE = 80;
export const UPTIME_REQUIREMENT_POST = 90;

/** Uptime percent a validation starting at `at` must hit to earn its reward. */
export function uptimeRequirementAt(at: number, network: HeliconNetwork = "mainnet"): number {
  return heliconActive(at, network) ? UPTIME_REQUIREMENT_POST : UPTIME_REQUIREMENT_PRE;
}

/* ---- ACP-273: minimum staking duration ---- */

export const MIN_STAKING_DAYS_PRE = 14;
const MIN_STAKING_DAYS_POST: Record<HeliconNetwork, number> = { mainnet: 2, fuji: 0.5 };

export function minStakingDaysAt(at: number, network: HeliconNetwork = "mainnet"): number {
  return heliconActive(at, network) ? MIN_STAKING_DAYS_POST[network] : MIN_STAKING_DAYS_PRE;
}

/** Label for the staking-term range, e.g. "48 hr – 1 yr". */
export function stakingTermLabelAt(at: number, network: HeliconNetwork = "mainnet"): string {
  if (!heliconActive(at, network)) return "2 wk – 1 yr";
  return network === "fuji" ? "12 hr – 1 yr" : "48 hr – 1 yr";
}
