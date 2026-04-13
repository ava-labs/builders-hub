import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi, successResponse } from '@/lib/api';
import { prisma } from '@/prisma/prisma';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLAIMS_PER_USER = 1;

const bodySchema = z.object({
  chains: z
    .array(
      z.object({
        faucetType: z.enum(['pchain', 'evm']),
        chainId: z.string().optional(),
      }),
    )
    .min(1, { message: 'At least one chain entry is required' }),
});

type BatchBody = z.infer<typeof bodySchema>;

interface ChainRateLimitStatus {
  chainId: string | null;
  faucetType: 'pchain' | 'evm';
  allowed: boolean;
  resetTime?: string;
}

export const POST = withApi<BatchBody>(
  async (_req: NextRequest, { session, body }) => {
    const { chains } = body;
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    const userClaims = await prisma.faucetClaim.findMany({
      where: {
        user_id: session.user.id,
        created_at: { gte: windowStart },
      },
      select: {
        faucet_type: true,
        chain_id: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const claimMap = new Map<string, Date>();
    for (const claim of userClaims) {
      const key = `${claim.faucet_type}:${claim.chain_id || 'null'}`;
      if (!claimMap.has(key)) {
        claimMap.set(key, claim.created_at);
      }
    }

    const limits: ChainRateLimitStatus[] = chains.map(({ faucetType, chainId }) => {
      const key = `${faucetType}:${chainId || 'null'}`;
      const oldestClaim = claimMap.get(key);

      const claimCount = userClaims.filter(
        (c) => c.faucet_type === faucetType && (c.chain_id || 'null') === (chainId || 'null'),
      ).length;

      if (claimCount >= MAX_CLAIMS_PER_USER && oldestClaim) {
        const resetTime = new Date(oldestClaim.getTime() + RATE_LIMIT_WINDOW_MS);
        return {
          chainId: chainId || null,
          faucetType,
          allowed: false,
          resetTime: resetTime.toISOString(),
        };
      }

      return {
        chainId: chainId || null,
        faucetType,
        allowed: true,
      };
    });

    return successResponse({ limits });
  },
  { auth: true, schema: bodySchema },
);
