import { NextRequest, NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import type { Erc20TokenBalance } from "@avalanche-sdk/chainkit/models/components";

// Initialize Avalanche SDK
const avalanche = new Avalanche({
  network: "mainnet",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> }
) {
  const startTime = performance.now();
  
  try {
    const { chainId, address } = await params;
    const { searchParams } = new URL(request.url);
    const pageToken = searchParams.get('pageToken') || undefined;

    // Validate address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
    }

    // Fetch ERC20 balances - returns a PageIterator
    const iterator = await avalanche.data.evm.address.balances.listErc20({
      address: address,
      chainId: chainId,
      currency: 'usd',
      filterSpamTokens: true,
      pageSize: 200,
      pageToken: pageToken,
    });

    // Get first page from the async iterator
    const { value: page, done } = await iterator[Symbol.asyncIterator]().next();
    
    if (done || !page) {
      return NextResponse.json({
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
    
    const duration = performance.now() - startTime;
    console.log(`[ERC20 Balances API] ${address} on chain ${chainId} - ${duration.toFixed(0)}ms, ${balances.length} tokens${nextPageToken ? ', has more pages' : ''}`);

    return NextResponse.json({
      balances,
      nextPageToken,
      pageValueUsd,
    } as Erc20BalancesResponse);
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[ERC20 Balances API] Error after ${duration.toFixed(0)}ms:`, error);
    return NextResponse.json({ error: 'Failed to fetch ERC20 balances' }, { status: 500 });
  }
}
