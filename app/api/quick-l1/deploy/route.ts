import { NextRequest, NextResponse } from 'next/server';
import { startMockDeployment } from '@/lib/quick-l1/mock-orchestrator';
import type { DeployRequest, DeployResponse } from '@/lib/quick-l1/types';
import { getUserId } from '@/app/api/managed-testnet-nodes/utils';

/**
 * POST /api/quick-l1/deploy
 *
 * Kicks off a Basic L1 Setup deployment.
 *
 * Auth:
 *   - Requires a builders-hub session. Unauthenticated calls 401.
 *   - Never trust `userId` from the request body — we overwrite it
 *     server-side from the session.
 *
 * Behavior:
 *   - If `QUICK_L1_SERVICE_URL` is set, proxies to the Railway microservice
 *     and attaches `x-quick-l1-secret` (service-to-service auth) plus the
 *     authenticated userId in the body.
 *   - Otherwise (local dev without the upstream), runs the in-memory
 *     mock orchestrator so the UI can be exercised without a backend.
 */
export async function POST(request: NextRequest): Promise<NextResponse<DeployResponse | { error: string }>> {
  // Gate the whole endpoint behind builders-hub auth — no deploys for
  // anonymous callers. In development mode `getUserId` returns a fixed
  // `'dev-user-id'` so local flows keep working.
  const { userId, error } = await getUserId();
  if (error) return error as NextResponse<{ error: string }>;
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let clientBody: Partial<DeployRequest>;
  try {
    clientBody = (await request.json()) as Partial<DeployRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!clientBody.chainName || !clientBody.tokenSymbol || !clientBody.ownerEvmAddress) {
    return NextResponse.json(
      { error: 'chainName, tokenSymbol, and ownerEvmAddress are required' },
      { status: 400 },
    );
  }
  if (clientBody.network !== 'fuji') {
    return NextResponse.json({ error: 'Only Fuji network is supported in the MVP' }, { status: 400 });
  }

  // Strip any client-supplied userId and inject the server-verified one.
  const body: DeployRequest = {
    chainName: clientBody.chainName,
    tokenSymbol: clientBody.tokenSymbol,
    ownerEvmAddress: clientBody.ownerEvmAddress,
    ownerPChainAddress: clientBody.ownerPChainAddress,
    network: 'fuji',
    precompiles: clientBody.precompiles,
    enableManagedRelayer: clientBody.enableManagedRelayer ?? false,
    userId,
  };

  const upstream = process.env.QUICK_L1_SERVICE_URL;
  if (upstream) {
    const secret = process.env.QUICK_L1_INTERNAL_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'QUICK_L1_INTERNAL_SECRET not configured on this server' },
        { status: 503 },
      );
    }
    // Tell the upstream which builders-hub origin to call back to for
    // register-node — so preview deploys register nodes onto themselves
    // rather than whatever `BUILDER_HUB_URL` the Railway env happens to
    // point at. `nextUrl.origin` is whatever host the browser hit.
    const res = await fetch(`${upstream.replace(/\/$/, '')}/deploy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-quick-l1-secret': secret,
        'x-builder-hub-url': request.nextUrl.origin,
      },
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
