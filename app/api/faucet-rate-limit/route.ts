import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLAIMS_PER_USER = 1;
const MAX_CLAIMS_PER_DESTINATION = 2;

interface RateLimitStatus {
  allowed: boolean;
  reason?: string;
  resetTime?: string;
  userClaimsInWindow: number;
  destinationClaimsInWindow: number;
  maxClaimsPerUser: number;
  maxClaimsPerDestination: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const faucetType = searchParams.get('faucetType') as 'pchain' | 'evm' | null;
    const destinationAddress = searchParams.get('address');
    const chainId = searchParams.get('chainId');

    if (!faucetType || !['pchain', 'evm'].includes(faucetType)) {
      return NextResponse.json(
        { success: false, message: 'Valid faucetType (pchain or evm) is required' },
        { status: 400 }
      );
    }

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const normalizedAddress = destinationAddress.toLowerCase();

    // Check per-user rate limit
    const userClaims = await prisma.faucetClaim.findMany({
      where: {
        user_id: session.user.id,
        faucet_type: faucetType,
        chain_id: chainId || null,
        created_at: { gte: windowStart }
      },
      orderBy: { created_at: 'asc' }
    });

    // Check per-destination rate limit
    const destinationClaims = await prisma.faucetClaim.findMany({
      where: {
        faucet_type: faucetType,
        chain_id: chainId || null,
        destination_address: normalizedAddress,
        created_at: { gte: windowStart }
      },
      orderBy: { created_at: 'asc' }
    });

    const status: RateLimitStatus = {
      allowed: true,
      userClaimsInWindow: userClaims.length,
      destinationClaimsInWindow: destinationClaims.length,
      maxClaimsPerUser: MAX_CLAIMS_PER_USER,
      maxClaimsPerDestination: MAX_CLAIMS_PER_DESTINATION
    };

    // Check if user has exceeded their limit
    if (userClaims.length >= MAX_CLAIMS_PER_USER) {
      const oldestClaim = userClaims[0];
      const resetTime = new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS);
      status.allowed = false;
      status.reason = 'user_limit_exceeded';
      status.resetTime = resetTime.toISOString();
    }
    // Check if destination has exceeded its limit
    else if (destinationClaims.length >= MAX_CLAIMS_PER_DESTINATION) {
      const oldestClaim = destinationClaims[0];
      const resetTime = new Date(oldestClaim.created_at.getTime() + RATE_LIMIT_WINDOW_MS);
      status.allowed = false;
      status.reason = 'destination_limit_exceeded';
      status.resetTime = resetTime.toISOString();
    }

    return NextResponse.json({ success: true, ...status });

  } catch (error) {
    console.error('Faucet rate limit check error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check rate limit' },
      { status: 500 }
    );
  }
}

