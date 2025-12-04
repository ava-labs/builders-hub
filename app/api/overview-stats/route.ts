import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";
import { STATS_CONFIG } from "@/types/stats";

export const dynamic = 'force-dynamic';

const avalanche = new Avalanche({ network: "mainnet" });

const TIME_RANGE_CONFIG = {
  day: { days: 3, secondsInRange: 24 * 60 * 60 },
  week: { days: 9, secondsInRange: 7 * 24 * 60 * 60 },
  month: { days: 32, secondsInRange: 30 * 24 * 60 * 60 }
} as const;

type TimeRangeKey = keyof typeof TIME_RANGE_CONFIG;

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalValidators: number;
    activeChains: number;
  };
  timeRange: TimeRangeKey;
  last_updated: number;
}

let cachedData: Map<string, { data: OverviewMetrics; timestamp: number }> = new Map();
let chainDataCache: Map<string, { data: ChainOverviewMetrics; timestamp: number }> = new Map();
let revalidatingKeys: Set<string> = new Set();

function getAllChains() {
  return l1ChainsData.filter(chain => (chain as any).isTestnet !== true).map(chain => ({
    chainId: chain.chainId,
    chainName: chain.chainName,
    logoUri: chain.chainLogoURI || '',
    subnetId: chain.subnetId
  }));
}

async function getTxCountData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (config.days * 24 * 60 * 60);
    let allResults: any[] = [];
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId,
      metric: 'txCount' as any,
      startTimestamp,
      endTimestamp,
      timeInterval: "day",
      pageSize: config.days + 1,
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      break;
    }

    const sorted = allResults.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]?.value || 0;

    if (timeRange === 'day') {
      return sorted[1]?.value || 0;
    } else {
      const daysToSum = timeRange === 'week' ? 7 : 30;
      let sum = 0;
      for (let i = 1; i <= Math.min(daysToSum, sorted.length - 1); i++) {
        sum += sorted[i]?.value || 0;
      }
      return sum;
    }
  } catch {
    return 0;
  }
}

async function getActiveAddressesData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (30 * 24 * 60 * 60);
    let allResults: any[] = [];
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId,
      metric: 'activeAddresses',
      startTimestamp,
      endTimestamp,
      timeInterval: timeRange,
      pageSize: 2,
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    const result = await avalanche.metrics.chains.getMetrics(params);
    
    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      break;
    }

    const sorted = allResults.sort((a: any, b: any) => b.timestamp - a.timestamp);
    const dataPoint = sorted.length > 1 ? sorted[1] : sorted[0];
    return dataPoint?.value || 0;
  } catch {
    return 0;
  }
}

async function getICMData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    const daysToFetch = config.days + 1;
    
    const response = await fetch(`https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${daysToFetch}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return 0;
    const data = await response.json();
    if (!Array.isArray(data)) return 0;

    const sorted = data.sort((a: any, b: any) => b.timestamp - a.timestamp);
    if (sorted.length < 2) return 0;

    if (timeRange === 'day') {
      return sorted[1]?.messageCount || 0;
    } else {
      const daysToSum = timeRange === 'week' ? 7 : 30;
      let sum = 0;
      for (let i = 1; i <= Math.min(daysToSum, sorted.length - 1); i++) {
        sum += sorted[i]?.messageCount || 0;
      }
      return sum;
    }
  } catch {
    return 0;
  }
}

async function getValidatorCount(subnetId: string): Promise<number | string> {
  try {
    if (!subnetId || subnetId === "N/A") return "N/A";

    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount?pageSize=1&subnetId=${subnetId}${rlToken ? `&rltoken=${rlToken}` : ''}`;   
    const validatorResponse = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!validatorResponse.ok) return "N/A";

    const validatorData = await validatorResponse.json();
    const value = validatorData?.results?.[0]?.value;
    return value ? Number(value) : "N/A";
  } catch {
    return "N/A";
  }
}

async function fetchChainMetrics(chain: any, timeRange: TimeRangeKey): Promise<ChainOverviewMetrics | null> {
  const cacheKey = `${chain.chainId}-${timeRange}`;
  const cached = chainDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return cached.data;
  }

  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    
    const [txCount, activeAddresses, icmMessages, validatorCount] = await Promise.all([
      getTxCountData(chain.chainId, timeRange),
      getActiveAddressesData(chain.chainId, timeRange),
      getICMData(chain.chainId, timeRange),
      getValidatorCount(chain.subnetId),
    ]);

    const tps = txCount / config.secondsInRange;

    const result: ChainOverviewMetrics = {
      chainId: chain.chainId,
      chainName: chain.chainName,
      chainLogoURI: chain.logoUri,
      txCount,
      tps,
      activeAddresses,
      icmMessages,
      validatorCount,
    };

    chainDataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch {
    return null;
  }
}

async function fetchFreshData(timeRange: TimeRangeKey): Promise<{ data: OverviewMetrics; fetchTime: number; chainCount: number } | null> {
  try {
    const startTime = Date.now();
    const allChains = getAllChains();
    const chainResults = await Promise.allSettled(
      allChains.map(chain => fetchChainMetrics(chain, timeRange))
    );

    const chainMetrics = chainResults
      .filter((result): result is PromiseFulfilledResult<ChainOverviewMetrics> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);

    let totalTxCount = 0;
    let totalActiveAddresses = 0;
    let totalICMMessages = 0;
    let totalValidators = 0;
    let activeChains = 0;

    chainMetrics.forEach(chain => {
      totalTxCount += chain.txCount || 0;
      totalActiveAddresses += chain.activeAddresses || 0;
      totalICMMessages += chain.icmMessages || 0;
      
      if (typeof chain.validatorCount === 'number') {
        totalValidators += chain.validatorCount;
      }
      
      if (chain.txCount > 0 || chain.activeAddresses > 0) {
        activeChains++;
      }
    });

    const config = TIME_RANGE_CONFIG[timeRange];
    const totalTps = totalTxCount / config.secondsInRange;

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      aggregated: {
        totalTxCount,
        totalTps,
        totalActiveAddresses,
        totalICMMessages,
        totalValidators,
        activeChains
      },
      timeRange,
      last_updated: Date.now()
    };

    cachedData.set(timeRange, {
      data: metrics,
      timestamp: Date.now()
    });

    return {
      data: metrics,
      fetchTime: Date.now() - startTime,
      chainCount: chainMetrics.length
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRangeParam = searchParams.get('timeRange') || 'day';
    
    const timeRange: TimeRangeKey = timeRangeParam in TIME_RANGE_CONFIG 
      ? (timeRangeParam as TimeRangeKey) 
      : 'day';
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      chainDataCache.clear();
      revalidatingKeys.clear();
    }
    
    const cached = cachedData.get(timeRange);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.SHORT_DURATION;
    const isCacheStale = cached && !isCacheValid;
    
    // Stale-while-revalidate
    if (isCacheStale && !revalidatingKeys.has(timeRange)) {
      revalidatingKeys.add(timeRange);
      fetchFreshData(timeRange).finally(() => revalidatingKeys.delete(timeRange));
      
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'stale-while-revalidate',
          'X-Cache-Age': `${Math.round(cacheAge / 1000)}s`,
          'X-Time-Range': timeRange,
        }
      });
    }
    
    if (isCacheValid) {
      return NextResponse.json(cached!.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'cache',
          'X-Cache-Age': `${Math.round(cacheAge / 1000)}s`,
          'X-Time-Range': timeRange,
        }
      });
    }
    
    const freshData = await fetchFreshData(timeRange);
    
    if (!freshData) {
      return NextResponse.json({ error: 'Failed to fetch chain metrics' }, { status: 500 });
    }
    
    return NextResponse.json(freshData.data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${freshData.fetchTime}ms`,
        'X-Chain-Count': freshData.chainCount.toString(),
        'X-Time-Range': timeRange,
      }
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chain metrics' }, { status: 500 });
  }
}
