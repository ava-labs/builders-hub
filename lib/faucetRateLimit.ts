import { prisma } from '@/prisma/prisma';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLAIMS_PER_USER = 1;
const MAX_CLAIMS_PER_DESTINATION = 2;

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  resetTime?: Date;
}

/**
 * Check if a user can claim from the faucet (DB-backed rate limiting)
 *
 * Two limits are enforced:
 * 1. Per-user: Max 1 claim per user per 24 hours per faucet type/chain
 * 2. Per-destination: Max 2 claims to the same address per 24 hours
 */
export async function checkFaucetRateLimit(
  userId: string,
  faucetType: 'pchain' | 'evm',
  destinationAddress: string,
  chainId?: string
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const normalizedAddress = destinationAddress.toLowerCase();

  // Check per-user rate limit
  const userClaimCount = await prisma.faucetClaim.count({
    where: {
      user_id: userId,
      faucet_type: faucetType,
      chain_id: chainId || null,
      created_at: { gte: windowStart }
    }
  });

  if (userClaimCount >= MAX_CLAIMS_PER_USER) {
    const lastClaim = await prisma.faucetClaim.findFirst({
      where: {
        user_id: userId,
        faucet_type: faucetType,
        chain_id: chainId || null,
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

  // Check per-destination rate limit (prevents multiple accounts draining to same address)
  const destinationClaimCount = await prisma.faucetClaim.count({
    where: {
      faucet_type: faucetType,
      chain_id: chainId || null,
      destination_address: normalizedAddress,
      created_at: { gte: windowStart }
    }
  });

  if (destinationClaimCount >= MAX_CLAIMS_PER_DESTINATION) {
    const oldestClaim = await prisma.faucetClaim.findFirst({
      where: {
        faucet_type: faucetType,
        chain_id: chainId || null,
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

/**
 * Record a successful faucet claim
 */
export async function recordFaucetClaim(
  userId: string,
  faucetType: 'pchain' | 'evm',
  destinationAddress: string,
  amount: string,
  txHash?: string,
  chainId?: string
): Promise<void> {
  await prisma.faucetClaim.create({
    data: {
      user_id: userId,
      faucet_type: faucetType,
      chain_id: chainId || null,
      destination_address: destinationAddress.toLowerCase(),
      amount,
      tx_hash: txHash
    }
  });
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
