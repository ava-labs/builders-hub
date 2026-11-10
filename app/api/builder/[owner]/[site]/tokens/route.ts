import { NextResponse, type NextRequest } from 'next/server';
import { getClientId } from '@/lib/mcp-rate-limit';
import { checkRateLimit } from '@/lib/rateLimit';
import { StudioError } from '@/server/services/studio/errors';
import { publicSite } from '@/server/services/studio/sites';
import { tokenBalancesIn, tokenListIn, type TokenScope } from '@/server/services/studio/tokens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LIMIT = { windowMs: 60_000, maxRequests: 60 };

/** Token data for a published site's visitors, scoped to the contracts and chains that site was published with. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ owner: string; site: string }> }) {
  const { owner, site } = await params;
  const limit = checkRateLimit(`builder-tokens:${getClientId(request)}`, LIMIT);
  if (!limit.allowed)
    return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const published = await publicSite(owner, site);
  if (!published) return NextResponse.json({ error: 'not_found', message: 'No site here' }, { status: 404 });
  const scope: TokenScope = {
    contracts: published.contracts,
    chains: Object.fromEntries(Object.entries(published.chains).map(([id, c]) => [Number(id), { rpcUrl: c.rpcUrl }])),
  };

  const chainId = Number(request.nextUrl.searchParams.get('chainId'));
  const address = request.nextUrl.searchParams.get('owner');
  try {
    if (!Number.isInteger(chainId) || chainId <= 0) throw new StudioError(400, 'Pass ?chainId= as an EVM chain id');
    if (address) return NextResponse.json(await tokenBalancesIn(scope, chainId, address));
    return NextResponse.json({ tokens: await tokenListIn(scope, chainId) });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.code ?? 'error', message: error.message }, { status: error.status });
    }
    console.error('[builder tokens]', error);
    return NextResponse.json({ error: 'error', message: 'Token lookup failed' }, { status: 500 });
  }
}
