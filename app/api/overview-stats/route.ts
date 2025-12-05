import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";
import { STATS_CONFIG } from "@/types/stats";

export const dynamic = 'force-dynamic';

const SECONDS_PER_DAY = 24 * 60 * 60;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_CHAINS = 10;

const avalanche = new Avalanche({ network: "mainnet" });

const TIME_RANGE_CONFIG = {
  day: { days: 3, secondsInRange: SECONDS_PER_DAY },
  week: { days: 9, secondsInRange: 7 * SECONDS_PER_DAY },
  month: { days: 32, secondsInRange: 30 * SECONDS_PER_DAY }
} as const;

type TimeRangeKey = keyof typeof TIME_RANGE_CONFIG;

interface MetricResult { timestamp: number; value: number; }
interface ICMResult { timestamp: number; messageCount: number; }

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

interface ChainInfo {
  chainId: string;
  chainName: string;
  logoUri: string;
  subnetId: string;
}

const cachedData = new Map<string, { data: OverviewMetrics; timestamp: number }>();
const chainDataCache = new Map<string, { data: ChainOverviewMetrics; timestamp: number }>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<OverviewMetrics | null>>();

const getRlToken = () => process.env.METRICS_BYPASS_TOKEN || '';

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

function sumMessageCounts(sorted: ICMResult[], daysToSum: number): number {
  let sum = 0;
  for (let i = 1; i <= Math.min(daysToSum, sorted.length - 1); i++) {
    sum += sorted[i]?.messageCount || 0;
  }
  return sum;
}

function getAllChains(): ChainInfo[] {
  return l1ChainsData
    .filter(chain => !('isTestnet' in chain && chain.isTestnet === true))
    .map(chain => ({
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
    const startTimestamp = endTimestamp - (config.days * SECONDS_PER_DAY);
    const rlToken = getRlToken();
    
    const result = await avalanche.metrics.chains.getMetrics({
      chainId,
      metric: 'txCount' as const,
      startTimestamp,
      endTimestamp,
      timeInterval: "day" as const,
      pageSize: config.days + 1,
      ...(rlToken && { rltoken: rlToken }),
    });
    
    const allResults: MetricResult[] = [];
    for await (const page of result) {
      if (page?.result?.results && Array.isArray(page.result.results)) {
        allResults.push(...page.result.results);
        break;
      }
    }

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
    const rlToken = getRlToken();
    
    const result = await avalanche.metrics.chains.getMetrics({
      chainId,
      metric: 'activeAddresses' as const,
      startTimestamp,
      endTimestamp,
      timeInterval: timeRange,
      pageSize: 2,
      ...(rlToken && { rltoken: rlToken }),
    });
    
    const allResults: MetricResult[] = [];
    for await (const page of result) {
      if (page?.result?.results && Array.isArray(page.result.results)) {
        allResults.push(...page.result.results);
        break;
      }
    }

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
    const daysToFetch = TIME_RANGE_CONFIG[timeRange].days + 1;
    const response = await fetchWithTimeout(
      `https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${daysToFetch}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return 0;
    const data: ICMResult[] = await response.json();
    if (!Array.isArray(data)) return 0;

    const sorted = sortByTimestampDesc(data);
    if (sorted.length < 2) return 0;
    if (timeRange === 'day') return sorted[1]?.messageCount || 0;
    return sumMessageCounts(sorted, timeRange === 'week' ? 7 : 30);
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[getICMData] Failed for chain ${chainId}:`, error);
    }
    return 0;
  }
}

async function getValidatorCount(subnetId: string): Promise<number | string> {
  if (!subnetId || subnetId === "N/A") return "N/A";

  try {
    const rlToken = getRlToken();
    const url = new URL('https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount');
    url.searchParams.set('pageSize', '1');
    url.searchParams.set('subnetId', subnetId);
    if (rlToken) url.searchParams.set('rltoken', rlToken);
    
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
    
    const chainResults = await processInBatches(allChains, (chain) => fetchChainMetrics(chain, timeRange), MAX_CONCURRENT_CHAINS);
    const chainMetrics = chainResults
      .filter((r): r is PromiseFulfilledResult<ChainOverviewMetrics> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    const aggregated = chainMetrics.reduce((acc, chain) => {
      acc.totalTxCount += chain.txCount || 0;
      acc.totalActiveAddresses += chain.activeAddresses || 0;
      acc.totalICMMessages += chain.icmMessages || 0;
      if (typeof chain.validatorCount === 'number') acc.totalValidators += chain.validatorCount;
      if (chain.txCount > 0 || chain.activeAddresses > 0) acc.activeChains++;
      return acc;
    }, { totalTxCount: 0, totalActiveAddresses: 0, totalICMMessages: 0, totalValidators: 0, activeChains: 0 });

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      aggregated: { ...aggregated, totalTps: aggregated.totalTxCount / TIME_RANGE_CONFIG[timeRange].secondsInRange },
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
