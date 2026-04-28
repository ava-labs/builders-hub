import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { getUserId, jsonError, jsonOk } from '../../managed-testnet-nodes/utils';
import { aggregateL1s, type NodeRow } from '@/lib/console/my-l1s';

/**
 * GET /api/console/my-l1s
 * Returns the L1s tied to the authenticated user's Builder Hub account.
 * Includes BOTH active and expired registrations so the dashboard can show
 * past L1s the user provisioned. Caller distinguishes via `MyL1.status`.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const nodes = await prisma.nodeRegistration.findMany({
      where: { user_id: userId! },
      orderBy: { created_at: 'desc' },
    });
    if (nodes.length === 0) {
      return jsonOk({ l1s: [], total: 0 });
    }
    const l1s = await aggregateL1s(nodes as NodeRow[]);
    return jsonOk({ l1s, total: l1s.length });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : 'Failed to load my L1s',
      err,
    );
  }
}
