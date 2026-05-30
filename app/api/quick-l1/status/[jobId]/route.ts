import { NextRequest, NextResponse } from 'next/server';
import { getMockJob } from '@/lib/quick-l1/mock-orchestrator';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { getUserId } from '@/app/api/managed-testnet-nodes/utils';

/**
 * GET /api/quick-l1/status/:jobId
 *
 * Returns the current state of a deployment job. Frontend polls this
 * every ~2s while the deployment is running.
 *
 * Auth: requires builders-hub session. The proxy passes the session
 * userId to the quick-l1 service which double-checks that the requested
 * job was created by this user (404 on mismatch — doesn't reveal that
 * someone else's job exists).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse<DeploymentJob | { error: string }>> {
  const { userId, error } = await getUserId();
  if (error) return error as NextResponse<{ error: string }>;
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { jobId } = await params;

  const upstream = process.env.QUICK_L1_SERVICE_URL;
  if (upstream) {
    const secret = process.env.QUICK_L1_INTERNAL_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'QUICK_L1_INTERNAL_SECRET not configured on this server' },
        { status: 503 },
      );
    }
    const res = await fetch(`${upstream.replace(/\/$/, '')}/status/${encodeURIComponent(jobId)}`, {
      // Don't cache — status changes every 2s.
      cache: 'no-store',
      headers: {
        'x-quick-l1-secret': secret,
        'x-user-id': userId,
      },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  const job = getMockJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  // Same user-scoping as the upstream service — an authenticated user
  // can only poll their own mock jobs.
  if (job.request.userId !== userId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}
