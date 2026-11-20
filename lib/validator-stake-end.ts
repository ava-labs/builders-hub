/* What a Primary Network validator's end time means, shared by the alert job
   and the alerts dashboard. An ACP-236 auto-renewed validator's end time is
   the end of its current cycle. At the cycle end the P-Chain renews it only
   when its uptime for the cycle is at least 90% (ACP-267); below that it
   removes the validator and returns the stake. */

export const RENEWAL_UPTIME_PERCENT = 90;

/** final: the stake ends at the end time (renewal off, or a fixed duration).
 *  renews: the stake auto-renews and the uptime meets the renewal threshold.
 *  at_risk: the stake auto-renews, but the uptime is below the threshold.
 *  unknown: the renewal state could not be read. */
export type StakeEnd = 'final' | 'renews' | 'at_risk' | 'unknown';

export function stakeEnd(renews: boolean | null | undefined, uptimePercent: number): StakeEnd {
  if (renews === null || renews === undefined) return 'unknown';
  if (!renews) return 'final';
  return uptimePercent < RENEWAL_UPTIME_PERCENT ? 'at_risk' : 'renews';
}
