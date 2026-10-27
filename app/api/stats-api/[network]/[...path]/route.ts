import { NextResponse, type NextRequest } from 'next/server';
import { STATS_API_BASE } from '@/lib/stats-api';

/* The same-origin relay for the P-Chain reads of the console (components/toolbox/coreViem/utils/statsApi.ts). A
   cached Stats API response can carry its Access-Control-Allow-Origin header twice, and the browser then refuses it,
   so the browser reads here and this handler reads the Stats API. Only the routes that the console reads are
   forwarded; status and body pass through, so a caller can tell a miss (404) from an outage. */

export const dynamic = 'force-dynamic';

const NETWORKS = new Set(['mainnet', 'testnet', 'fuji']);
const CB58 = '[1-9A-HJ-NP-Za-km-z]{20,60}';
const ROUTES = [
  new RegExp(`^blockchains/${CB58}$`),
  new RegExp(`^subnets/${CB58}$`),
  /^l1Validators$/,
  new RegExp(`^blockchains/p-chain/transactions/${CB58}$`),
];
const TX_ROUTE = /^blockchains\/p-chain\/transactions\//;

const TIMEOUT_MS = 15_000;
// The console polls for state that it just changed (a new chain, a new validator), so only a transaction, which is
// final once the Stats API has it, is cached.
const NO_STORE = 'no-store';
const IMMUTABLE = 'public, max-age=3600, s-maxage=86400';

export async function GET(request: NextRequest, { params }: { params: Promise<{ network: string; path: string[] }> }) {
  const { network, path } = await params;
  const resource = path.join('/');
  if (!NETWORKS.has(network) || !ROUTES.some((route) => route.test(resource))) {
    return NextResponse.json({ message: 'Unknown route', statusCode: 404 }, { status: 404 });
  }

  try {
    const upstream = await fetch(`${STATS_API_BASE}/v1/networks/${network}/${resource}${request.nextUrl.search}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': upstream.ok && TX_ROUTE.test(resource) ? IMMUTABLE : NO_STORE,
      },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    console.error('[stats-api relay]', resource, error);
    return NextResponse.json(
      { message: timedOut ? 'Stats API timeout' : 'Stats API unreachable', statusCode: timedOut ? 504 : 502 },
      { status: timedOut ? 504 : 502 },
    );
  }
}
