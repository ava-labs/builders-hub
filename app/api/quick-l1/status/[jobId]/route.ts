import { NextRequest, NextResponse } from 'next/server';
import { getMockJob } from '@/lib/quick-l1/mock-orchestrator';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { getUserId } from '@/app/api/managed-testnet-nodes/utils';
import { withQuickL1WafToken } from '@/lib/quick-l1/waf';
import { upstreamPath } from '@/lib/explorer-proxy-path';

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
  // a job ID is one path segment of the deploy service's status route, and it goes there with the service's secret
  if (jobId.length > 128 || upstreamPath([jobId]) === null) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const upstream = process.env.QUICK_L1_SERVICE_URL;
  if (upstream) {
    const secret = process.env.QUICK_L1_INTERNAL_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'QUICK_L1_INTERNAL_SECRET not configured on this server' },
        { status: 503 },
      );
    }
    const res = await fetch(withQuickL1WafToken(`${upstream.replace(/\/$/, '')}/status/${encodeURIComponent(jobId)}`), {
      // Don't cache — status changes every 2s.
      cache: 'no-store',
      headers: {
        'x-quick-l1-secret': secret,
        'x-user-id': userId,
      },
    });
    // A failed step can name the address the deploy service used inside the cluster. The caller gets the text
    // with that address left out.
    const text = (await res.text()).replace(/https?:\/\/[a-z0-9.-]+:\d+/gi, 'the node service');
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
