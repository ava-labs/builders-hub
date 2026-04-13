import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Avalanche } from '@avalanche-sdk/chainkit';
import type { Erc20TokenBalance } from '@avalanche-sdk/chainkit/models/components';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { validateParams } from '@/lib/api/validate';
import { EVM_ADDRESS_REGEX } from '@/lib/api/constants';

const paramsSchema = z.object({
  chainId: z.string().regex(/^\d+$/, 'chainId must be numeric'),
  address: z.string().regex(EVM_ADDRESS_REGEX, 'Invalid EVM address format'),
});

// Initialize Avalanche SDK
const avalanche = new Avalanche({
  network: 'mainnet',
});

interface Erc20Balance {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  price?: number;
  valueUsd?: number;
  logoUri?: string;
}

interface Erc20BalancesResponse {
  balances: Erc20Balance[];
  nextPageToken?: string;
  pageValueUsd: number;
}

export const GET = withApi(
  async (req: NextRequest, { params }) => {
    const { chainId, address } = validateParams(params, paramsSchema);
    const { searchParams } = new URL(req.url);
    const pageToken = searchParams.get('pageToken') || undefined;

    // Fetch ERC20 balances - returns a PageIterator
    const iterator = await avalanche.data.evm.address.balances.listErc20({
      address,
      chainId,
      currency: 'usd',
      filterSpamTokens: true,
      pageSize: 200,
      pageToken,
    });

    // Get first page from the async iterator
    const { value: page, done } = await iterator[Symbol.asyncIterator]().next();

    if (done || !page) {
      return successResponse({
        balances: [],
        nextPageToken: undefined,
        pageValueUsd: 0,
      } as Erc20BalancesResponse);
    }

    // Extract data from the page result
    const pageResult = page.result;
    const erc20Tokens: Erc20TokenBalance[] = pageResult.erc20TokenBalances || [];
    const nextPageToken = pageResult.nextPageToken;

    // Map tokens to our format
    const balances: Erc20Balance[] = erc20Tokens.map((token) => {
      const decimals = token.decimals;
      const balance = token.balance;
      const balanceFormatted = (Number(balance) / Math.pow(10, decimals)).toFixed(6);
      const priceValue = token.price?.value;
      const price = priceValue ? (typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue) : undefined;
      const valueUsd = price ? parseFloat(balanceFormatted) * price : undefined;

      return {
        contractAddress: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals,
        balance,
        balanceFormatted,
        price,
        valueUsd,
        logoUri: token.logoUri,
      };
    });

    // Calculate total USD value for this page
    const pageValueUsd = balances.reduce((sum, token) => sum + (token.valueUsd || 0), 0);

    // Sort by value (highest first) within this page
    balances.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));

    return successResponse({
      balances,
      nextPageToken,
      pageValueUsd,
    } as Erc20BalancesResponse);
  },
  {
    rateLimit: { windowMs: 60_000, maxRequests: 60, identifier: 'ip' },
  },
);
