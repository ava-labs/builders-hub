import { NextResponse } from "next/server";
import icttTokens from "@/constants/ictt-tokens.json";
import l1ChainsData from "@/constants/l1-chains.json";

interface ICTTTransfer {
  homeChainBlockchainId: string;
  homeChainName: string;
  remoteChainBlockchainId: string;
  remoteChainName: string;
  direction: string;
  contractAddress: string;
  coinAddress: string;
  transferCount: number;
  transferCoinsTotal: number;
}

interface TokenInfo {
  name: string;
  symbol: string;
  coingeckoId?: string;
}

interface TokenPrice {
  usd: number;
}

interface CachedData {
  data: any;
  timestamp: number;
}

interface ChainData {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  subnetId: string;
  blockchainId?: string;
  slug: string;
  color: string;
  category: string;
  explorers: Array<{ name: string; link: string }>;
}

// Cache for 1.5 days (36 hours)
const CACHE_DURATION = 36 * 60 * 60 * 1000;
let cachedData: CachedData | null = null;

// Helper function to get token info
function getTokenInfo(address: string): TokenInfo {
  const normalizedAddress = address.toLowerCase();
  const token = (icttTokens as Record<string, TokenInfo>)[normalizedAddress] || 
                (icttTokens as Record<string, TokenInfo>)[address];
  
  if (token) {
    return token;
  }
  
  // Return formatted address if token not found
  return {
    name: `${address.slice(0, 6)}...${address.slice(-4)}`,
    symbol: "UNKNOWN",
  };
}

// Helper function to get chain info by blockchain ID
function getChainInfoByBlockchainId(blockchainId: string) {
  // Find the chain in l1-chains.json using the blockchainId field
  const chain = (l1ChainsData as ChainData[]).find(
    (c) => c.blockchainId === blockchainId
  );
  
  return chain;
}

// Fetch prices from CoinGecko
async function fetchTokenPrices(
  coingeckoIds: string[]
): Promise<Record<string, number>> {
  if (coingeckoIds.length === 0) return {};

  try {
    const ids = coingeckoIds.join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("CoinGecko API error:", response.status);
      return {};
    }

    const data = await response.json();
    const prices: Record<string, number> = {};

    for (const [id, priceData] of Object.entries(data)) {
      prices[id] = (priceData as TokenPrice).usd;
    }

    return prices;
  } catch (error) {
    console.error("Error fetching token prices:", error);
    return {};
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clearCache = searchParams.get("clearCache") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Check cache
    if (
      !clearCache &&
      cachedData &&
      Date.now() - cachedData.timestamp < CACHE_DURATION
    ) {
      const paginatedData = {
        ...cachedData.data,
        transfers: cachedData.data.allTransfers.slice(offset, offset + limit),
        totalCount: cachedData.data.allTransfers.length,
        hasMore: offset + limit < cachedData.data.allTransfers.length,
      };
      delete paginatedData.allTransfers;
      
      return NextResponse.json(paginatedData, {
        headers: {
          "Cache-Control": "public, max-age=86400",
          "X-Data-Source": "cache",
          "X-Cache-Timestamp": new Date(cachedData.timestamp).toISOString(),
        },
      });
    }

    // Fetch ICTT data
    const endTs = Math.floor(Date.now() / 1000);
    const icttResponse = await fetch(
      `https://idx6.solokhin.com/api/global/ictt/transfers?startTs=0&endTs=${endTs}`
    );

    if (!icttResponse.ok) {
      throw new Error(`ICTT API error: ${icttResponse.status}`);
    }

    const transfers: ICTTTransfer[] = await icttResponse.json();

    // Collect unique token addresses with CoinGecko IDs
    const coingeckoIds = new Set<string>();
    const tokenAddressToCoingeckoId: Record<string, string> = {};

    transfers.forEach((transfer) => {
      const tokenInfo = getTokenInfo(transfer.coinAddress);
      if (tokenInfo.coingeckoId) {
        coingeckoIds.add(tokenInfo.coingeckoId);
        tokenAddressToCoingeckoId[transfer.coinAddress.toLowerCase()] =
          tokenInfo.coingeckoId;
      }
    });

    // Fetch prices
    const prices = await fetchTokenPrices(Array.from(coingeckoIds));

    // Process transfers with token info
    const enrichedTransfers = transfers.map((transfer) => {
      const tokenInfo = getTokenInfo(transfer.coinAddress);
      const homeChain = getChainInfoByBlockchainId(transfer.homeChainBlockchainId);
      const remoteChain = getChainInfoByBlockchainId(transfer.remoteChainBlockchainId);
      
      let priceUsd = 0;
      if (tokenInfo.coingeckoId && prices[tokenInfo.coingeckoId]) {
        priceUsd = prices[tokenInfo.coingeckoId];
      }

      return {
        ...transfer,
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        priceUsd,
        volumeUsd: transfer.transferCoinsTotal * priceUsd,
        homeChainLogo: homeChain?.chainLogoURI || "",
        homeChainColor: homeChain?.color || "#E84142",
        homeChainDisplayName: homeChain?.chainName || transfer.homeChainName,
        remoteChainLogo: remoteChain?.chainLogoURI || "",
        remoteChainColor: remoteChain?.color || "#E84142",
        remoteChainDisplayName: remoteChain?.chainName || transfer.remoteChainName,
      };
    });

    // Calculate aggregated stats
    const totalTransfers = transfers.reduce(
      (sum, t) => sum + t.transferCount,
      0
    );
    
    const totalVolumeUsd = enrichedTransfers.reduce(
      (sum, t) => sum + t.volumeUsd,
      0
    );

    // Get unique active chains
    const activeChains = new Set<string>();
    transfers.forEach((t) => {
      activeChains.add(t.homeChainName);
      activeChains.add(t.remoteChainName);
    });

    // Get top token by transfer count
    const tokenCounts: Record<string, { name: string; symbol: string; count: number }> = {};
    enrichedTransfers.forEach((t) => {
      const key = t.coinAddress.toLowerCase();
      if (!tokenCounts[key]) {
        tokenCounts[key] = { 
          name: t.tokenName, 
          symbol: t.tokenSymbol,
          count: 0 
        };
      }
      tokenCounts[key].count += t.transferCount;
    });

    const topToken = Object.values(tokenCounts).sort(
      (a, b) => b.count - a.count
    )[0];

    const topTokenPercentage = totalTransfers > 0 
      ? ((topToken.count / totalTransfers) * 100).toFixed(1)
      : "0";

    // Get top routes
    const routes: Record<
      string,
      { name: string; total: number; direction: string }
    > = {};
    enrichedTransfers.forEach((t) => {
      const routeKey = `${t.homeChainBlockchainId}_${t.remoteChainBlockchainId}_${t.direction}`;
      if (!routes[routeKey]) {
        const homeName = t.homeChainDisplayName;
        const remoteName = t.remoteChainDisplayName;
        // For "out" direction: home → remote (home is sending out to remote)
        // For "in" direction: remote → home (remote is sending to home)
        routes[routeKey] = {
          name:
            t.direction === "out"
              ? `${homeName} → ${remoteName}`
              : `${remoteName} → ${homeName}`,
          total: 0,
          direction: t.direction,
        };
      }
      routes[routeKey].total += t.transferCount;
    });

    const topRoutes = Object.values(routes)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Get token distribution
    const tokenDistribution = Object.entries(tokenCounts)
      .map(([address, data]) => ({
        name: data.name,
        symbol: data.symbol,
        value: data.count,
        address,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const sortedTransfers = enrichedTransfers.sort(
      (a, b) => b.transferCount - a.transferCount
    );

    const fullResponseData = {
      overview: {
        totalTransfers,
        totalVolumeUsd,
        activeChains: activeChains.size,
        activeRoutes: Object.keys(routes).length,
        topToken: {
          name: topToken.name,
          percentage: topTokenPercentage,
        },
      },
      topRoutes,
      tokenDistribution,
      allTransfers: sortedTransfers,
      last_updated: Date.now(),
    };

    const { allTransfers, ...baseData } = fullResponseData;
    const responseData = {
      ...baseData,
      transfers: sortedTransfers.slice(offset, offset + limit),
      totalCount: sortedTransfers.length,
      hasMore: offset + limit < sortedTransfers.length,
    };

    cachedData = {
      data: fullResponseData,
      timestamp: Date.now(),
    };

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Data-Source": "fresh",
      },
    });
  } catch (error) {
    console.error("Error fetching ICTT stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch ICTT stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

