import type { Tone } from './ui';

/* The dashboard's stake-end reading. The fleet feed's days_left counts to the
   validator's end time. For an ACP-236 auto-renewed validator that is the end
   of its current cycle, not of its stake, so a renewing stake reads "Renews". */

const expiryTone = (days: number): Tone | null => (days <= 7 ? 'alerting' : days <= 30 ? 'warning' : null);

/** The Expires reading: "Renews" with no tone when the stake auto-renews, else days left. */
export function expiryReading(daysLeft: number, stakeRenews: boolean | null | undefined): { text: string; tone: Tone | null } {
  if (stakeRenews === true) return { text: 'Renews', tone: null };
  return { text: `${daysLeft}d`, tone: expiryTone(daysLeft) };
}

/** True when the row warns "Stake expiring soon". Never for a stake that auto-renews. */
export function isStakeExpiring(
  alert: { expiry_alert: boolean; expiry_days: number; stake_renews?: boolean | null },
  daysLeft: number,
): boolean {
  return alert.expiry_alert && alert.stake_renews !== true && daysLeft <= alert.expiry_days;
}
