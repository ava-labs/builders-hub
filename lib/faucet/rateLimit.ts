import { prisma } from '@/prisma/prisma';
import { acquireAdvisoryLock } from '@/lib/db/advisoryLock';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CLAIMS_PER_USER = 1;
const MAX_CLAIMS_PER_DESTINATION = 2;


interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  resetTime?: Date;
}

export async function checkAndReserveFaucetClaim(
  userId: string,
  faucetType: 'pchain' | 'evm' | 'devnet',
  destinationAddress: string,
  amount: string,
  chainId?: string,
  couponId?: string
): Promise<RateLimitResult & { claimId?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const normalizedAddress = destinationAddress.toLowerCase();
  const normalizedChainId = chainId || null;

  return prisma.$transaction(async (tx) => {
    // Serialise every concurrent claim that shares this user or this
    // destination address before reading any counts. Without it the count and
    // the insert below straddle a window in which another transaction does the
    // same read, so N parallel requests all observe "under the limit" and all
    // insert — the daily cap is enforced once per burst instead of once per
    // day. Both limits are locked because they have different scopes: one is
    // per user, the other per destination across users.
    await acquireAdvisoryLock(
      tx,
      `faucet:user:${userId}:${faucetType}:${normalizedChainId ?? ''}`,
      `faucet:addr:${normalizedAddress}:${faucetType}:${normalizedChainId ?? ''}`,
    );

    const userClaimCount = await tx.faucetClaim.count({
      where: {
        user_id: userId,
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        created_at: { gte: windowStart }
      }
    });

    if (userClaimCount >= MAX_CLAIMS_PER_USER) {
      const lastClaim = await tx.faucetClaim.findFirst({
        where: {
          user_id: userId,
          faucet_type: faucetType,
          chain_id: normalizedChainId,
          created_at: { gte: windowStart }
        },
        orderBy: { created_at: 'asc' }
      });

      const resetTime = lastClaim
        ? new Date(lastClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS)
        : new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

      return {
        allowed: false,
        reason: `Rate limit exceeded. You can claim again after ${formatResetTime(resetTime)}.`,
        resetTime
      };
    }

    const destinationClaimCount = await tx.faucetClaim.count({
      where: {
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        destination_address: normalizedAddress,
        created_at: { gte: windowStart }
      }
    });

    if (destinationClaimCount >= MAX_CLAIMS_PER_DESTINATION) {
      const oldestClaim = await tx.faucetClaim.findFirst({
        where: {
          faucet_type: faucetType,
          chain_id: normalizedChainId,
          destination_address: normalizedAddress,
          created_at: { gte: windowStart }
        },
        orderBy: { created_at: 'asc' }
      });

      const resetTime = oldestClaim
        ? new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS)
        : new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

      return {
        allowed: false,
        reason: `This address has reached its daily claim limit. Try again after ${formatResetTime(resetTime)}.`,
        resetTime
      };
    }

    // The claim row has a FK to users(id). If the session references a user that
    // is no longer in the table (stale session / signup not yet committed), the
    // insert fails with a raw "FaucetClaim_user_id_fkey" Prisma error that leaks
    // to the client as a 500. Verify the user up front and return a clean reason.
    const userExists = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!userExists) {
      return {
        allowed: false,
        reason: 'We could not verify your account. Please sign out and sign back in, then try again.'
      };
    }

    const claim = await tx.faucetClaim.create({
      data: {
        user_id: userId,
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        destination_address: normalizedAddress,
        amount,
        tx_hash: null,
        coupon_id: couponId ?? null
      }
    });

    return { allowed: true, claimId: claim.id };
  });
}

export async function checkFaucetRateLimit(
  userId: string,
  faucetType: 'pchain' | 'evm' | 'devnet',
  destinationAddress: string,
  chainId?: string
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const normalizedAddress = destinationAddress.toLowerCase();
  const normalizedChainId = chainId || null;

  const userClaimCount = await prisma.faucetClaim.count({
    where: {
      user_id: userId,
      faucet_type: faucetType,
      chain_id: normalizedChainId,
      created_at: { gte: windowStart }
    }
  });

  if (userClaimCount >= MAX_CLAIMS_PER_USER) {
    const lastClaim = await prisma.faucetClaim.findFirst({
      where: {
        user_id: userId,
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        created_at: { gte: windowStart }
      },
      orderBy: { created_at: 'asc' }
    });

    const resetTime = lastClaim
      ? new Date(lastClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS)
      : new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

    return {
      allowed: false,
      reason: `Rate limit exceeded. You can claim again after ${formatResetTime(resetTime)}.`,
      resetTime
    };
  }

  const destinationClaimCount = await prisma.faucetClaim.count({
    where: {
      faucet_type: faucetType,
      chain_id: normalizedChainId,
      destination_address: normalizedAddress,
      created_at: { gte: windowStart }
    }
  });

  if (destinationClaimCount >= MAX_CLAIMS_PER_DESTINATION) {
    const oldestClaim = await prisma.faucetClaim.findFirst({
      where: {
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        destination_address: normalizedAddress,
        created_at: { gte: windowStart }
      },
      orderBy: { created_at: 'asc' }
    });

    const resetTime = oldestClaim
      ? new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS)
      : new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

    return {
      allowed: false,
      reason: `This address has reached its daily claim limit. Try again after ${formatResetTime(resetTime)}.`,
      resetTime
    };
  }

  return { allowed: true };
}

export async function completeFaucetClaim(claimId: string, txHash: string): Promise<void> {
  await prisma.faucetClaim.update({
    where: { id: claimId },
    data: { tx_hash: txHash }
  });
}

export async function cancelFaucetClaim(claimId: string): Promise<void> {
  try {
    await prisma.faucetClaim.delete({ where: { id: claimId } });
  } catch {
    // Record may already be gone
  }
}

function formatResetTime(resetTime: Date): string {
  const now = Date.now();
  const diffMs = resetTime.getTime() - now;
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffMs / (1000 * 60));

  const localString = resetTime.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  let relativeTime = '';
  if (diffHours >= 1) {
    relativeTime = `in about ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 1) {
    relativeTime = `in about ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    relativeTime = 'in less than a minute';
  }

  return `${localString} (${relativeTime})`;
}
