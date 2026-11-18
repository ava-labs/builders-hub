import 'server-only';
import { acquireAdvisoryLock } from '@/lib/db/advisoryLock';
import { prisma } from '@/prisma/prisma';

/*
 * Daily per-account caps on what Builder Hub provisions with its own service
 * credentials: Quick L1 deployments (a managed validator node and contracts on
 * Fuji, signed by the Quick L1 service) and managed testnet nodes.
 *
 * Counted in the database, so the cap holds across serverless instances and
 * restarts, unlike the per-minute burst limit in lib/rateLimit.ts, which lives
 * in each instance's memory. A row is written for every attempt sent to the
 * upstream service, accepted or not, as the burst limit counts attempts too.
 */

export type ProvisionKind = 'quick-l1-deploy' | 'managed-testnet-node';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Placeholder defaults: the maintainers should set them from real usage. 0 refuses every request. */
const LIMITS: Record<ProvisionKind, { env: string; fallback: number; noun: string }> = {
  'quick-l1-deploy': { env: 'QUICK_L1_DAILY_DEPLOYS', fallback: 10, noun: 'Quick L1 deployments' },
  'managed-testnet-node': { env: 'MANAGED_TESTNET_NODES_DAILY_CREATES', fallback: 10, noun: 'managed testnet nodes' },
};

export function dailyProvisionLimit(kind: ProvisionKind): number {
  const { env, fallback } = LIMITS[kind];
  const raw = process.env[env];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export type ProvisionReservation =
  | { allowed: true }
  | { allowed: false; limit: number; resetAt: Date; message: string };

/**
 * Records one provisioning attempt for the account if it is under its cap for
 * the last 24 hours, and refuses it otherwise. Call it right before the
 * upstream request, after the request has passed local validation.
 */
export async function reserveDailyProvision(userId: string, kind: ProvisionKind): Promise<ProvisionReservation> {
  // Local development talks to mocks or a developer's own services, as the burst limit's dev setting assumes.
  if (process.env.NODE_ENV === 'development') return { allowed: true };

  const limit = dailyProvisionLimit(kind);
  const where = { user_id: userId, kind, created_at: { gte: new Date(Date.now() - DAY_MS) } };

  return prisma.$transaction(async (tx) => {
    // Without the lock, parallel requests all read the same count and all pass.
    await acquireAdvisoryLock(tx, `provision:${kind}:${userId}`);
    const used = await tx.provisionAttempt.count({ where });
    if (used >= limit) {
      const oldest = await tx.provisionAttempt.findFirst({
        where,
        orderBy: { created_at: 'asc' },
        select: { created_at: true },
      });
      const resetAt = new Date((oldest?.created_at.getTime() ?? Date.now()) + DAY_MS);
      const message =
        `Daily limit reached: an account can start ${limit} ${LIMITS[kind].noun} in 24 hours. ` +
        `Try again after ${resetAt.toISOString()}.`;
      return { allowed: false, limit, resetAt, message };
    }
    await tx.provisionAttempt.create({ data: { user_id: userId, kind } });
    return { allowed: true };
  });
}

/** Seconds until the cap frees a slot, for a Retry-After header. */
export function retryAfterSeconds(resetAt: Date): string {
  return String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)));
}
