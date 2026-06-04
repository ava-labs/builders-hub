import { NextRequest, NextResponse } from 'next/server';
import { Context } from '@avalabs/avalanchejs';
import { getRPCEndpoint } from '@/components/toolbox/coreViem/utils/rpc';
import { stringifyContext } from '@/components/toolbox/coreViem/utils/contextSerde';

// Resolve the Avalanche network Context server-side. The browser otherwise lets
// the SDK fetch it directly from the public X-Chain endpoint (avm.getAssetDescription),
// which bypasses the Core wallet transport and fails from non-production origins.
// Doing it here (same pattern as app/api/pchain-faucet/route.ts) keeps the call
// same-origin for the client and off the public endpoint's CORS/rate-limit path.

const CACHE_TTL_MS = 60_000; // IDs/assetID are static; fees drift slowly.

type NetworkKey = 'testnet' | 'mainnet';

const cache: Record<NetworkKey, { body: string; expires: number } | undefined> = {
  testnet: undefined,
  mainnet: undefined,
};

function contextJson(body: string): NextResponse {
  // body is already JSON (with bigints tagged by stringifyContext) — return as-is.
  return new NextResponse(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function GET(req: NextRequest) {
  try {
    const isTestnet = req.nextUrl.searchParams.get('testnet') !== 'false';
    const key: NetworkKey = isTestnet ? 'testnet' : 'mainnet';

    const cached = cache[key];
    if (cached && cached.expires > Date.now()) {
      return contextJson(cached.body);
    }

    const context = await Context.getContextFromURI(getRPCEndpoint(isTestnet));
    const body = stringifyContext(context);
    cache[key] = { body, expires: Date.now() + CACHE_TTL_MS };

    return contextJson(body);
  } catch (error) {
    console.error('avalanche-context resolution failed:', error);
    return NextResponse.json(
      { error: 'Failed to resolve Avalanche network context. Please try again.' },
      { status: 502 },
    );
  }
}
