import { StudioError } from '@/server/services/studio/errors';
import { tokenBalances, tokenList } from '@/server/services/studio/tokens';
import { studioRoute } from '../../../_lib/route';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** ?chainId= lists tokens for the chain; adding &owner= returns that address's non-zero ERC-20 balances. */
export const GET = studioRoute<{ projectId: string }>(async ({ request, params, userId }) => {
  const chainId = Number(request.nextUrl.searchParams.get('chainId'));
  if (!Number.isInteger(chainId) || chainId <= 0) throw new StudioError(400, 'Pass ?chainId= as an EVM chain id');
  const owner = request.nextUrl.searchParams.get('owner');
  if (owner) return tokenBalances(userId, params.projectId, chainId, owner);
  return { tokens: await tokenList(userId, params.projectId, chainId) };
});
