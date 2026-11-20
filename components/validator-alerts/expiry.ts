import { stakeEnd } from '@/lib/validator-stake-end';
import type { Tone } from './ui';

/* The dashboard's stake-end reading. The fleet feed's days_left counts to the
   validator's end time. For an ACP-236 auto-renewed validator that is the end
   of its current cycle, where the P-Chain renews it only with 90% uptime. */

const expiryTone = (days: number): Tone | null => (days <= 7 ? 'alerting' : days <= 30 ? 'warning' : null);

/** The Expires reading. A renewing stake reads "Renews in Nd" (the cycle end):
 *  no tone, or a warning tone when its uptime is below the renewal threshold.
 *  A stake that ends, or whose renewal is unknown, reads days left. */
export function expiryReading(
  daysLeft: number,
  stakeRenews: boolean | null | undefined,
  uptimePercent: number,
): { text: string; tone: Tone | null } {
  const end = stakeEnd(stakeRenews, uptimePercent);
  if (end === 'renews') return { text: `Renews in ${daysLeft}d`, tone: null };
  if (end === 'at_risk') return { text: `Renews in ${daysLeft}d`, tone: 'warning' };
  return { text: `${daysLeft}d`, tone: expiryTone(daysLeft) };
}

/** The row's expiry warning, or null. Never "Stake expiring soon" for a stake
 *  that auto-renews; "Renewal at risk" when its uptime is below the threshold. */
export function expiryWarning(
  alert: { expiry_alert: boolean; expiry_days: number; stake_renews?: boolean | null },
  daysLeft: number,
  uptimePercent: number,
): string | null {
  if (!alert.expiry_alert || daysLeft > alert.expiry_days) return null;
  const end = stakeEnd(alert.stake_renews, uptimePercent);
  if (end === 'renews') return null;
  return end === 'at_risk' ? 'Renewal at risk' : 'Stake expiring soon';
}
