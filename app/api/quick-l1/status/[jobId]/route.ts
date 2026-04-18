import { NextRequest, NextResponse } from 'next/server';
import { getMockJob } from '@/lib/quick-l1/mock-orchestrator';
import type { DeploymentJob } from '@/lib/quick-l1/types';

/**
 * GET /api/quick-l1/status/:jobId
 *
 * Returns the current state of a deployment job. Frontend polls this
 * every ~2s while the deployment is running.
 *
 * Behavior mirrors /api/quick-l1/deploy — proxies to Railway when
 * `QUICK_L1_SERVICE_URL` is set, otherwise serves from the in-memory
 * mock orchestrator.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse<DeploymentJob | { error: string }>> {
  const { jobId } = await params;

  const upstream = process.env.QUICK_L1_SERVICE_URL;
  if (upstream) {
    const res = await fetch(`${upstream.replace(/\/$/, '')}/status/${encodeURIComponent(jobId)}`, {
      // Don't cache — status changes every 2s.
      cache: 'no-store',
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
  return NextResponse.json(job);
}
