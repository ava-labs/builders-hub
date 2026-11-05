import { prisma } from '@/prisma/prisma';
import { normalizeEmail } from '@/lib/utils';

/** `ValidatorAlert.source` for a row imported from the retired Avalanche Notify service. */
export const LEGACY_NOTIFY_SOURCE = 'avalanche-notify';

interface AlertKey {
  node_id: string;
  subnet_id: string;
}

export interface UnclaimedAlert extends AlertKey {
  id: string;
}

export interface ClaimPlan {
  /** Rows to attach to the user. */
  attach: string[];
  /** Rows to delete: the user already has an alert for the same node and network. */
  drop: string[];
}

function keyOf(alert: AlertKey): string {
  return `${alert.subnet_id}\n${alert.node_id}`;
}

/**
 * Decide what happens to the unclaimed rows of one email address when its user signs in.
 *
 * - A row for a node that the user already watches on the same network is a duplicate.
 *   Drop it: the user's own alert keeps the settings the user chose, both rows mail the
 *   same address, and the unique (user_id, node_id, subnet_id) index refuses a second row.
 * - Two unclaimed rows for one node: attach the first (the caller sorts oldest first),
 *   drop the others.
 * - The 20-alert cap does not apply. It limits what a user creates in the UI. Dropping an
 *   imported alert would stop alerts that the person asked for. A user over the cap can
 *   still pause or delete alerts, and cannot create one until the count is under the cap.
 */
export function planLegacyClaim(owned: AlertKey[], unclaimed: UnclaimedAlert[]): ClaimPlan {
  const taken = new Set(owned.map(keyOf));
  const plan: ClaimPlan = { attach: [], drop: [] };
  for (const row of unclaimed) {
    const key = keyOf(row);
    if (taken.has(key)) {
      plan.drop.push(row.id);
    } else {
      taken.add(key);
      plan.attach.push(row.id);
    }
  }
  return plan;
}

/**
 * Attach the imported validator alerts for `email` (rows with no user) to `userId`.
 * Call it after sign-in or sign-up, when the User row exists.
 *
 * It never throws: a failure is logged and returns null, so it cannot block a sign-in.
 * The next sign-in tries again.
 */
export async function claimLegacyValidatorAlerts(userId: string, email: string): Promise<ClaimPlan | null> {
  try {
    if (!userId || !email) return null;
    const unclaimed = await prisma.validatorAlert.findMany({
      where: { user_id: null, email: normalizeEmail(email) },
      select: { id: true, node_id: true, subnet_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (unclaimed.length === 0) return { attach: [], drop: [] };

    const owned = await prisma.validatorAlert.findMany({
      where: { user_id: userId },
      select: { node_id: true, subnet_id: true },
    });
    const plan = planLegacyClaim(owned, unclaimed);

    // `user_id: null` in both filters: a concurrent sign-in that claimed a row first wins.
    await prisma.$transaction([
      prisma.validatorAlert.deleteMany({ where: { id: { in: plan.drop }, user_id: null } }),
      prisma.validatorAlert.updateMany({
        where: { id: { in: plan.attach }, user_id: null },
        data: { user_id: userId },
      }),
    ]);
    console.log(
      `[validator-alerts] user ${userId}: attached ${plan.attach.length} imported alert(s), dropped ${plan.drop.length} duplicate(s)`,
    );
    return plan;
  } catch (error) {
    console.error('[validator-alerts] Could not attach imported alerts:', error);
    return null;
  }
}
