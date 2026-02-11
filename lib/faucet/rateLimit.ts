import { prisma } from '@/prisma/prisma';

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
  faucetType: 'pchain' | 'evm',
  destinationAddress: string,
  amount: string,
  chainId?: string
): Promise<RateLimitResult & { claimId?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const normalizedAddress = destinationAddress.toLowerCase();
  const normalizedChainId = chainId || null;

  return prisma.$transaction(async (tx) => {
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

    const claim = await tx.faucetClaim.create({
      data: {
        user_id: userId,
        faucet_type: faucetType,
        chain_id: normalizedChainId,
        destination_address: normalizedAddress,
        amount,
        tx_hash: null
      }
    });

    return { allowed: true, claimId: claim.id };
  });
}

export async function checkFaucetRateLimit(
  userId: string,
  faucetType: 'pchain' | 'evm',
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
