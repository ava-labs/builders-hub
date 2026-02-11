import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLAIMS_PER_USER = 1;

interface ChainRateLimitStatus {
  chainId: string | null;
  faucetType: 'pchain' | 'evm';
  allowed: boolean;
  resetTime?: string;
}

interface BatchRateLimitResponse {
  success: boolean;
  limits: ChainRateLimitStatus[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { chains } = body as { 
      chains: Array<{ faucetType: 'pchain' | 'evm'; chainId?: string }> 
    };

    if (!chains || !Array.isArray(chains)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    // Get all user claims in one query
    const userClaims = await prisma.faucetClaim.findMany({
      where: {
        user_id: session.user.id,
        created_at: { gte: windowStart }
      },
      select: {
        faucet_type: true,
        chain_id: true,
        created_at: true
      },
      orderBy: { created_at: 'asc' }
    });

    // Build a map of claims per faucet type/chain
    const claimMap = new Map<string, Date>();
    for (const claim of userClaims) {
      const key = `${claim.faucet_type}:${claim.chain_id || 'null'}`;
      if (!claimMap.has(key)) {
        claimMap.set(key, claim.created_at);
      }
    }

    // Check each requested chain
    const limits: ChainRateLimitStatus[] = chains.map(({ faucetType, chainId }) => {
      const key = `${faucetType}:${chainId || 'null'}`;
      const oldestClaim = claimMap.get(key);
      
      // Count claims for this faucet/chain
      const claimCount = userClaims.filter(
        c => c.faucet_type === faucetType && (c.chain_id || 'null') === (chainId || 'null')
      ).length;

      if (claimCount >= MAX_CLAIMS_PER_USER && oldestClaim) {
        const resetTime = new Date(oldestClaim.getTime() + RATE_LIMIT_WINDOW_MS);
        return {
          chainId: chainId || null,
          faucetType,
          allowed: false,
          resetTime: resetTime.toISOString()
        };
      }

      return {
        chainId: chainId || null,
        faucetType,
        allowed: true
      };
    });

    const response: BatchRateLimitResponse = {
      success: true,
      limits
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Batch faucet rate limit check error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check rate limits' },
      { status: 500 }
    );
  }
}

