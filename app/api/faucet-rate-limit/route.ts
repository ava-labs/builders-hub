import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi, successResponse, validateQuery } from '@/lib/api';
import { prisma } from '@/prisma/prisma';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLAIMS_PER_USER = 1;
const MAX_CLAIMS_PER_DESTINATION = 2;

const querySchema = z.object({
  faucetType: z.enum(['pchain', 'evm'], {
    error: 'Valid faucetType (pchain or evm) is required',
  }),
  address: z.string().min(1, 'Destination address is required'),
  chainId: z.string().optional(),
});

interface RateLimitStatus {
  allowed: boolean;
  reason?: string;
  resetTime?: string;
  userClaimsInWindow: number;
  destinationClaimsInWindow: number;
  maxClaimsPerUser: number;
  maxClaimsPerDestination: number;
}

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const { faucetType, address: destinationAddress, chainId } = validateQuery(req, querySchema);

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const normalizedAddress = destinationAddress.toLowerCase();

    const userClaims = await prisma.faucetClaim.findMany({
      where: {
        user_id: session.user.id,
        faucet_type: faucetType,
        chain_id: chainId || null,
        created_at: { gte: windowStart },
      },
      orderBy: { created_at: 'asc' },
    });

    const destinationClaims = await prisma.faucetClaim.findMany({
      where: {
        faucet_type: faucetType,
        chain_id: chainId || null,
        destination_address: normalizedAddress,
        created_at: { gte: windowStart },
      },
      orderBy: { created_at: 'asc' },
    });

    const status: RateLimitStatus = {
      allowed: true,
      userClaimsInWindow: userClaims.length,
      destinationClaimsInWindow: destinationClaims.length,
      maxClaimsPerUser: MAX_CLAIMS_PER_USER,
      maxClaimsPerDestination: MAX_CLAIMS_PER_DESTINATION,
    };

    if (userClaims.length >= MAX_CLAIMS_PER_USER) {
      const oldestClaim = userClaims[0];
      const resetTime = new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS);
      status.allowed = false;
      status.reason = 'user_limit_exceeded';
      status.resetTime = resetTime.toISOString();
    } else if (destinationClaims.length >= MAX_CLAIMS_PER_DESTINATION) {
      const oldestClaim = destinationClaims[0];
      const resetTime = new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS);
      status.allowed = false;
      status.reason = 'destination_limit_exceeded';
      status.resetTime = resetTime.toISOString();
    }

    return successResponse(status);
  },
  { auth: true },
);
