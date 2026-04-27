import { NextResponse } from 'next/server';
import l1ChainsData from "@/constants/l1-chains.json";
import { STATS_CONFIG } from "@/types/stats";
import { getChainICMCount } from "@/lib/icm-clickhouse";

export const dynamic = 'force-dynamic';

const SECONDS_PER_DAY = 24 * 60 * 60;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_CHAINS = 10;
const METRICS_API_URL = process.env.METRICS_API_URL;
if (!METRICS_API_URL) {
  console.warn('METRICS_API_URL is not set — overview-stats endpoint will fail');
}

const TIME_RANGE_CONFIG = {
  day: { days: 3, secondsInRange: SECONDS_PER_DAY },
  week: { days: 9, secondsInRange: 7 * SECONDS_PER_DAY },
  month: { days: 32, secondsInRange: 30 * SECONDS_PER_DAY }
} as const;

type TimeRangeKey = keyof typeof TIME_RANGE_CONFIG;

interface MetricResult { timestamp: number; value: number; }
interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  marketCap: number | null;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalMarketCap: number;
    totalValidators: number;
    activeChains: number;
    // Active L1s from P-Chain (source of truth). Falls back to enriched chain
    // count if P-Chain is unreachable.
    activeL1Count: number;
  };
  timeRange: TimeRangeKey;
  last_updated: number;
}

interface ChainInfo {
  chainId: string;
  chainName: string;
  logoUri: string;
  subnetId: string;
  coingeckoId?: string;
}

const cachedData = new Map<string, { data: OverviewMetrics; timestamp: number }>();
const chainDataCache = new Map<string, { data: ChainOverviewMetrics; timestamp: number }>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<OverviewMetrics | null>>();

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function processInBatches<T, R>(items: T[], processor: (item: T) => Promise<R>, batchSize: number): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...await Promise.allSettled(batch.map(processor)));
  }
  return results;
}

function sortByTimestampDesc<T extends { timestamp: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.timestamp - a.timestamp);
}

function sumValues(sorted: MetricResult[], daysToSum: number): number {
  let sum = 0;
  for (let i = 1; i <= Math.min(daysToSum, sorted.length - 1); i++) {
    sum += sorted[i]?.value || 0;
  }
  return sum;
}

function getAllChains(): ChainInfo[] {
  return l1ChainsData
    .filter(chain =>
      !('isTestnet' in chain && chain.isTestnet === true) &&
      !('isActive' in chain && chain.isActive === false)
    )
    .map(chain => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      logoUri: chain.chainLogoURI || '',
      subnetId: chain.subnetId,
      ...('coingeckoId' in chain && chain.coingeckoId ? { coingeckoId: chain.coingeckoId as string } : {}),
    }));
}

async function getTxCountData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (config.days * SECONDS_PER_DAY);

    const url = new URL(`${METRICS_API_URL}/v2/chains/${chainId}/metrics/txCount`);
    url.searchParams.set('timeInterval', 'day');
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', String(config.days + 1));

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`metrics-api ${res.status}`);
    const data = await res.json();

    const allResults: MetricResult[] = data.results || [];
    const sorted = sortByTimestampDesc(allResults);
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]?.value || 0;
    if (timeRange === 'day') return sorted[1]?.value || 0;
    return sumValues(sorted, timeRange === 'week' ? 7 : 30);
  } catch (error) {
    console.error(`[getTxCountData] Failed for chain ${chainId}:`, error);
    return 0;
  }
}

async function getActiveAddressesData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (30 * SECONDS_PER_DAY);

    const url = new URL(`${METRICS_API_URL}/v2/chains/${chainId}/metrics/activeAddresses`);
    url.searchParams.set('timeInterval', timeRange);
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', '2');

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`metrics-api ${res.status}`);
    const data = await res.json();

    const allResults: MetricResult[] = data.results || [];
    const sorted = sortByTimestampDesc(allResults);
    const dataPoint = sorted.length > 1 ? sorted[1] : sorted[0];
    return dataPoint?.value || 0;
  } catch (error) {
    console.error(`[getActiveAddressesData] Failed for chain ${chainId}:`, error);
    return 0;
  }
}

async function getICMData(chainId: string, timeRange: TimeRangeKey): Promise<number> {
  try {
    const daysToSum = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
    return await getChainICMCount(chainId, daysToSum);
  } catch (error) {
    console.error(`[getICMData] Failed for chain ${chainId}:`, error);
    return 0;
  }
}

// TODO: migrate to metrics-api when it supports validatorCount (currently a stub)
async function getValidatorCount(subnetId: string): Promise<number | string> {
  if (!subnetId || subnetId === "N/A") return "N/A";

  try {
    const url = new URL('https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount');
    url.searchParams.set('pageSize', '1');
    url.searchParams.set('subnetId', subnetId);
    
    const response = await fetchWithTimeout(url.toString(), { headers: { 'Accept': 'application/json' } });
    if (!response.ok) return "N/A";

    const data = await response.json();
    const value = data?.results?.[0]?.value;
    return value ? Number(value) : "N/A";
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[getValidatorCount] Failed for subnet ${subnetId}:`, error);
    }
    return "N/A";
  }
}

const MARKET_CAP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let marketCapCache: { data: Record<string, number>; timestamp: number } | null = null;

async function fetchMarketCaps(chains: ChainInfo[]): Promise<Record<string, number>> {
  if (marketCapCache && Date.now() - marketCapCache.timestamp < MARKET_CAP_CACHE_DURATION) {
    return marketCapCache.data;
  }

  const coingeckoIds = chains
    .filter(c => c.coingeckoId)
    .map(c => c.coingeckoId!);

  if (coingeckoIds.length === 0) return {};

  try {
    const ids = coingeckoIds.join(',');
    const response = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true`,
      { headers: { 'Accept': 'application/json' } },
      10000
    );

    if (!response.ok) return marketCapCache?.data ?? {};

    const data = await response.json();
    const result: Record<string, number> = {};

    for (const [coingeckoId, values] of Object.entries(data)) {
      const mcap = (values as any)?.usd_market_cap;
      if (typeof mcap === 'number' && mcap > 0) {
        result[coingeckoId] = mcap;
      }
    }

    marketCapCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.error('[fetchMarketCaps] Failed:', error);
    return marketCapCache?.data ?? {};
  }
}

async function fetchChainMetrics(chain: ChainInfo, timeRange: TimeRangeKey): Promise<ChainOverviewMetrics | null> {
  const cacheKey = `${chain.chainId}-${timeRange}`;
  const cached = chainDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return cached.data;
  }

  try {
    const [txCount, activeAddresses, icmMessages, validatorCount] = await Promise.all([
      getTxCountData(chain.chainId, timeRange),
      getActiveAddressesData(chain.chainId, timeRange),
      getICMData(chain.chainId, timeRange),
      getValidatorCount(chain.subnetId),
    ]);

    const result: ChainOverviewMetrics = {
      chainId: chain.chainId,
      chainName: chain.chainName,
      chainLogoURI: chain.logoUri,
      txCount,
      tps: txCount / TIME_RANGE_CONFIG[timeRange].secondsInRange,
      activeAddresses,
      icmMessages,
      marketCap: null,
      validatorCount,
    };

    chainDataCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`[fetchChainMetrics] Failed for chain ${chain.chainId}:`, error);
    return null;
  }
}

async function fetchFreshDataInternal(timeRange: TimeRangeKey): Promise<OverviewMetrics | null> {
  try {
    const startTime = Date.now();
    const allChains = getAllChains();
    
    const [chainResults, marketCaps] = await Promise.all([
      processInBatches(allChains, (chain) => fetchChainMetrics(chain, timeRange), MAX_CONCURRENT_CHAINS),
      fetchMarketCaps(allChains),
    ]);
    const chainMetrics = chainResults
      .filter((r): r is PromiseFulfilledResult<ChainOverviewMetrics> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    // Build coingeckoId -> chainId lookup and merge market caps
    const coingeckoToChainId = new Map<string, string>();
    for (const chain of allChains) {
      if (chain.coingeckoId) {
        coingeckoToChainId.set(chain.coingeckoId, chain.chainId);
      }
    }
    for (const [coingeckoId, mcap] of Object.entries(marketCaps)) {
      const chainId = coingeckoToChainId.get(coingeckoId);
      if (chainId) {
        const chainMetric = chainMetrics.find(c => c.chainId === chainId);
        if (chainMetric) {
          chainMetric.marketCap = mcap;
        }
      }
    }

    const aggregated = chainMetrics.reduce((acc, chain) => {
      acc.totalTxCount += chain.txCount || 0;
      acc.totalActiveAddresses += chain.activeAddresses || 0;
      acc.totalICMMessages += chain.icmMessages || 0;
      acc.totalMarketCap += chain.marketCap ?? 0;
      if (typeof chain.validatorCount === 'number') acc.totalValidators += chain.validatorCount;
      if (chain.txCount > 0 || chain.activeAddresses > 0) acc.activeChains++;
      return acc;
    }, { totalTxCount: 0, totalActiveAddresses: 0, totalICMMessages: 0, totalMarketCap: 0, totalValidators: 0, activeChains: 0 });

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      aggregated: {
        ...aggregated,
        totalTps: aggregated.totalTxCount / TIME_RANGE_CONFIG[timeRange].secondsInRange,
        // Headline count is the same set the table renders below — every
        // mainnet entry from l1-chains.json with isActive !== false. The
        // l1-chains.json catalog itself is seeded by P-Chain at build time
        // via scripts/enrich-chains.mts, so this number transitively reflects
        // P-Chain truth without a runtime P-Chain dependency.
        activeL1Count: chainMetrics.length,
      },
      timeRange,
      last_updated: Date.now()
    };

    cachedData.set(timeRange, { data: metrics, timestamp: Date.now() });
    console.log(`[fetchFreshData] Completed in ${Date.now() - startTime}ms, ${chainMetrics.length}/${allChains.length} chains`);
    return metrics;
  } catch (error) {
    console.error('[fetchFreshData] Failed:', error);
    return null;
  }
}

async function fetchFreshData(timeRange: TimeRangeKey): Promise<{ data: OverviewMetrics; fetchTime: number; chainCount: number } | null> {
  const startTime = Date.now();
  const pendingKey = `fresh-${timeRange}`;
  let pendingPromise = pendingRequests.get(pendingKey);
  
  if (!pendingPromise) {
    pendingPromise = fetchFreshDataInternal(timeRange);
    pendingRequests.set(pendingKey, pendingPromise);
    pendingPromise.finally(() => pendingRequests.delete(pendingKey));
  }
  
  const data = await pendingPromise;
  if (!data) return null;
  
  return { data, fetchTime: Date.now() - startTime, chainCount: data.chains.length };
}

function createResponse(
  data: OverviewMetrics | { error: string },
  meta: { source: string; timeRange?: TimeRangeKey; cacheAge?: number; fetchTime?: number; chainCount?: number },
  status = 200
) {
  const headers: Record<string, string> = { 'Cache-Control': CACHE_CONTROL_HEADER, 'X-Data-Source': meta.source };
  if (meta.timeRange) headers['X-Time-Range'] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  if (meta.chainCount !== undefined) headers['X-Chain-Count'] = meta.chainCount.toString();
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRangeParam = searchParams.get('timeRange') || 'day';
    const timeRange: TimeRangeKey = timeRangeParam in TIME_RANGE_CONFIG ? (timeRangeParam as TimeRangeKey) : 'day';
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      chainDataCache.clear();
      revalidatingKeys.clear();
    }
    
    const cached = cachedData.get(timeRange);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.SHORT_DURATION;
    const isCacheStale = cached && !isCacheValid;
    
    if (isCacheStale && !revalidatingKeys.has(timeRange)) {
      revalidatingKeys.add(timeRange);
      fetchFreshData(timeRange).finally(() => revalidatingKeys.delete(timeRange));
      return createResponse(cached.data, { source: 'stale-while-revalidate', timeRange, cacheAge });
    }
    
    if (isCacheValid && cached) {
      return createResponse(cached.data, { source: 'cache', timeRange, cacheAge });
    }
    
    const freshData = await fetchFreshData(timeRange);
    if (!freshData) {
      return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error' }, 500);
    }
    
    return createResponse(freshData.data, { source: 'fresh', timeRange, fetchTime: freshData.fetchTime, chainCount: freshData.chainCount });
  } catch (error) {
    console.error('[GET /api/overview-stats] Unhandled error:', error);
    return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error' }, 500);
  }
}
