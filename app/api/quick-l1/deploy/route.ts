import { NextRequest, NextResponse } from 'next/server';
import { startMockDeployment } from '@/lib/quick-l1/mock-orchestrator';
import type { DeployRequest, DeployResponse } from '@/lib/quick-l1/types';

/**
 * POST /api/quick-l1/deploy
 *
 * Kicks off a Basic L1 Setup deployment.
 *
 * Behavior:
 *   - If `QUICK_L1_SERVICE_URL` is set, proxies to the Railway microservice
 *     so the real avalanche.js + viem work happens there.
 *   - Otherwise (local dev), runs the in-memory mock orchestrator so the
 *     UI can be exercised without a backend.
 *
 * Auth: open for the mock. The real service will require a Builder Hub
 * session token and enforce per-user rate limits (1 deployment/day).
 */
export async function POST(request: NextRequest): Promise<NextResponse<DeployResponse | { error: string }>> {
  let body: DeployRequest;
  try {
    body = (await request.json()) as DeployRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.chainName || !body.tokenSymbol || !body.ownerEvmAddress) {
    return NextResponse.json(
      { error: 'chainName, tokenSymbol, and ownerEvmAddress are required' },
      { status: 400 },
    );
  }
  if (body.network !== 'fuji') {
    return NextResponse.json({ error: 'Only Fuji network is supported in the MVP' }, { status: 400 });
  }

  const upstream = process.env.QUICK_L1_SERVICE_URL;
  if (upstream) {
    // Proxy to Railway. Keep the payload/response shape identical so the
    // frontend contract stays single-sourced in lib/quick-l1/types.ts.
    const res = await fetch(`${upstream.replace(/\/$/, '')}/deploy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  const { jobId } = startMockDeployment(body);
  return NextResponse.json({ jobId });
}
