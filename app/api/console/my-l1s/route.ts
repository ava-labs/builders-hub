import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { getAuthSession } from '@/lib/auth/authSession';
import { getUserId, jsonError, jsonOk, rateLimited } from '../../managed-testnet-nodes/utils';
import { aggregateL1s, type NodeRow } from '@/lib/console/my-l1s';

// Throttle the dashboard's read endpoint at ~1 req/sec sustained. The page
// auto-refreshes on tab focus + visibilitychange, so a real user might burst
// 5–10 reads in a few seconds (alt-tabbing, refresh button) but a bot or a
// runaway loop is the only thing that hits this 60+ times in a minute.
async function rateLimitIdentifier(): Promise<string> {
  // Dev rate-limit short-circuits in `getUserId` so we mirror that with a
  // stable dev identifier here. In prod, key on the user's email so the
  // bucket is per-account, not per-IP.
  if (process.env.NODE_ENV === 'development') return 'dev-user';
  const session = await getAuthSession();
  const email = session?.user?.email;
  if (!email) throw new Error('Authentication required');
  return `my-l1s:${email}`;
}

/**
 * GET /api/console/my-l1s
 * Returns the L1s tied to the authenticated user's Builder Hub account.
 * Includes BOTH active and expired registrations so the dashboard can show
 * past L1s the user provisioned. Caller distinguishes via `MyL1.status`.
 */
async function handleGet(_request: NextRequest): Promise<NextResponse> {
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
    // Pass the raw err only to the third arg (logged server-side, never
    // returned to the client). The user-facing message is a static string
    // — Prisma errors leak DB schema, query parameters, and connection
    // details that the dashboard caller has no business seeing.
    return jsonError(500, 'Failed to load my L1s', err);
  }
}

export const GET = rateLimited(handleGet, {
  dev: { windowMs: 60_000, max: 1000 },
  prod: { windowMs: 60_000, max: 60 },
  identifier: rateLimitIdentifier,
});
