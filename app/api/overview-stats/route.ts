import { NextResponse } from 'next/server';
import l1ChainsData from "@/constants/l1-chains.json";
import { STATS_CONFIG } from "@/types/stats";
import { getChainICMCount } from "@/lib/icm-clickhouse";
import { DEDICATED_STATS_BASE_URL, toStatsChainId } from "@/lib/dedicated-stats";

export const dynamic = 'force-dynamic';

const SECONDS_PER_DAY = 24 * 60 * 60;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_CHAINS = 10;
const STATS_API_URL = DEDICATED_STATS_BASE_URL;

// P-Chain is the authority on how many L1s exist, and it answers for every
// subnet whether or not we index it. Chain *counts* must come from here, not
// from how many chains we happen to have figures for.
const P_CHAIN_RPC = 'https://api.avax.network/ext/bc/P';

// days = daily buckets to pull from metrics-api (window + a 2-day buffer so
// the newest complete bucket is never the edge one). secondsInRange divides
// the summed txCount into tps and, over SECONDS_PER_DAY, gives the number of
// daily buckets to sum — one source of truth per range.
const TIME_RANGE_CONFIG = {
  day: { days: 3, secondsInRange: SECONDS_PER_DAY },
  week: { days: 9, secondsInRange: 7 * SECONDS_PER_DAY },
  month: { days: 32, secondsInRange: 30 * SECONDS_PER_DAY },
  quarter: { days: 92, secondsInRange: 90 * SECONDS_PER_DAY },
  year: { days: 367, secondsInRange: 365 * SECONDS_PER_DAY }
} as const;

type TimeRangeKey = keyof typeof TIME_RANGE_CONFIG;

interface MetricResult { timestamp: number; value: number; }

/**
 * One figure from the metrics API.
 *
 * `v: null` means we have no number, and it must never render as 0. A chain we
 * do not index and a chain that genuinely had no transactions are different facts.
 */
interface Metric { v: number | null; ok: boolean }
const NO_DATA: Metric = { v: null, ok: true };
const UNAVAILABLE: Metric = { v: null, ok: false };

/**
 * A 4xx from the metrics API means it does not track this chain, not that it is
 * having trouble. Those chains are genuinely unindexed and should say so. 5xx and
 * network failures are outages and stay unavailable.
 */
const isNotTracked = (status: number) => status >= 400 && status < 500;

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
  tps: number | null;
  activeAddresses: number | null;
  icmMessages: number | null;
  marketCap: number | null;
  volume24h: number | null;
  validatorCount: number | string;
  metricsOk: boolean;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  coverage: { indexed: number; total: number };
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
    contributors: { txCount: number; activeAddresses: number; icmMessages: number };
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

/**
 * How many L1s are live on mainnet, straight from P-Chain.
 *
 * `getAllValidatorsAt` at height `proposed` returns the validator set per
 * subnet, and a subnet with a non-empty set is a running L1. Deliberately not
 * `getCurrentValidators`: that lists registered validators regardless of state,
 * so under ACP-77 it reports healthy-looking sets for chains whose L1 validators
 * have run out of fee balance. Same definition scripts/enrich-chains.ts uses to
 * decide isActive, so the headline and the catalog cannot disagree.
 *
 * Returns null if P-Chain is unreachable; the caller falls back rather than
 * publishing a count it did not verify.
 */
let l1CountCache: { counts: Map<string, number>; at: number } | null = null;

async function getPChainValidatorCounts(): Promise<Map<string, number> | null> {
  const fresh = await loadPChainValidatorSets();
  return fresh;
}

async function getActiveL1CountFromPChain(): Promise<number | null> {
  const counts = await loadPChainValidatorSets();
  if (!counts) return null;
  return counts.size - (counts.has(PRIMARY_NETWORK_SUBNET_ID) ? 1 : 0);
}

async function loadPChainValidatorSets(): Promise<Map<string, number> | null> {
  if (l1CountCache && Date.now() - l1CountCache.at < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return l1CountCache.counts;
  }
  try {
    const res = await fetchWithTimeout(P_CHAIN_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'platform.getAllValidatorsAt',
        params: { height: 'proposed' },
      }),
    });
    if (!res.ok) throw new Error(`p-chain ${res.status}`);
    const body = await res.json();
    const sets = body?.result?.validatorSets;
    if (!sets || typeof sets !== 'object') throw new Error('unexpected p-chain response');
    const counts = new Map<string, number>();
    for (const [subnetId, set] of Object.entries(sets)) {
      const validators = (set as { validators?: unknown[] })?.validators;
      if (!Array.isArray(validators) || validators.length === 0) continue;
      counts.set(subnetId, validators.length);
    }
    l1CountCache = { counts, at: Date.now() };
    return counts;
  } catch (error) {
    console.error('[loadPChainValidatorSets] failed:', error);
    return null;
  }
}

const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

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

async function getTxCountData(chainId: string, timeRange: TimeRangeKey): Promise<Metric> {
  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (config.days * SECONDS_PER_DAY);

    const url = new URL(`${STATS_API_URL}/v2/chains/${toStatsChainId(chainId)}/metrics/txCount`);
    url.searchParams.set('timeInterval', 'day');
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', String(config.days + 1));

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      if (isNotTracked(res.status)) return NO_DATA;
      throw new Error(`metrics-api ${res.status}`);
    }
    const data = await res.json();

    const allResults: MetricResult[] = data.results || [];
    const sorted = sortByTimestampDesc(allResults);
    if (sorted.length === 0) return NO_DATA;
    if (sorted.length === 1) return { v: sorted[0]?.value ?? 0, ok: true };
    if (timeRange === 'day') return { v: sorted[1]?.value ?? 0, ok: true };
    return { v: sumValues(sorted, config.secondsInRange / SECONDS_PER_DAY), ok: true };
  } catch (error) {
    console.error(`[getTxCountData] Failed for chain ${chainId}:`, error);
    return UNAVAILABLE;
  }
}

async function getActiveAddressesData(chainId: string, timeRange: TimeRangeKey): Promise<Metric> {
  try {
    const endTimestamp = Math.floor(Date.now() / 1000);

    // active addresses is a distinct count, not a sum — the API only buckets it
    // by day/week/month, so quarter and year (no wider bucket exists) read the
    // monthly figure rather than an unsupported interval.
    //
    // 'month' has to be in this set too. It asks for monthly buckets like the
    // other two, so it needs the same widened lookback.
    const isMonthly = timeRange === 'month' || timeRange === 'quarter' || timeRange === 'year';
    const interval = isMonthly ? 'month' : timeRange;
    const startTimestamp = endTimestamp - ((isMonthly ? 65 : 30) * SECONDS_PER_DAY);

    const url = new URL(`${STATS_API_URL}/v2/chains/${toStatsChainId(chainId)}/metrics/activeAddresses`);
    url.searchParams.set('timeInterval', interval);
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', '2');

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      if (isNotTracked(res.status)) return NO_DATA;
      throw new Error(`metrics-api ${res.status}`);
    }
    const data = await res.json();

    const allResults: MetricResult[] = data.results || [];
    const sorted = sortByTimestampDesc(allResults);
    const dataPoint = sorted.length > 1 ? sorted[1] : sorted[0];
    if (!dataPoint) return NO_DATA;
    return { v: dataPoint.value ?? 0, ok: true };
  } catch (error) {
    console.error(`[getActiveAddressesData] Failed for chain ${chainId}:`, error);
    return UNAVAILABLE;
  }
}

async function getICMData(chainId: string, timeRange: TimeRangeKey): Promise<Metric> {
  try {
    const daysToSum = TIME_RANGE_CONFIG[timeRange].secondsInRange / SECONDS_PER_DAY;
    const count = await getChainICMCount(chainId, daysToSum);
    return typeof count === 'number' ? { v: count, ok: true } : NO_DATA;
  } catch (error) {
    console.error(`[getICMData] Failed for chain ${chainId}:`, error);
    return UNAVAILABLE;
  }
}

async function getValidatorCount(subnetId: string): Promise<number | string> {
  if (!subnetId || subnetId === "N/A") return "N/A";
  const counts = await getPChainValidatorCounts();
  if (!counts) return "N/A";
  return counts.get(subnetId) ?? 0;
}

const MARKET_CAP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
interface TokenMarketData { mcap: number; vol: number | null }
let marketCapCache: { data: Record<string, TokenMarketData>; timestamp: number } | null = null;

async function fetchMarketCaps(chains: ChainInfo[]): Promise<Record<string, TokenMarketData>> {
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
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`,
      { headers: { 'Accept': 'application/json' } },
      10000
    );

    if (!response.ok) return marketCapCache?.data ?? {};

    const data = await response.json();
    const result: Record<string, TokenMarketData> = {};

    for (const [coingeckoId, values] of Object.entries(data)) {
      const mcap = (values as any)?.usd_market_cap;
      const vol = (values as any)?.usd_24h_vol;
      if (typeof mcap === 'number' && mcap > 0) {
        result[coingeckoId] = { mcap, vol: typeof vol === 'number' && vol > 0 ? vol : null };
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
      txCount: txCount.v,
      tps: txCount.v === null ? null : txCount.v / TIME_RANGE_CONFIG[timeRange].secondsInRange,
      activeAddresses: activeAddresses.v,
      icmMessages: icmMessages.v,
      marketCap: null,
      volume24h: null,
      validatorCount,
      metricsOk: txCount.ok && activeAddresses.ok && icmMessages.ok,
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
    for (const [coingeckoId, market] of Object.entries(marketCaps)) {
      const chainId = coingeckoToChainId.get(coingeckoId);
      if (chainId) {
        const chainMetric = chainMetrics.find(c => c.chainId === chainId);
        if (chainMetric) {
          chainMetric.marketCap = market.mcap;
          chainMetric.volume24h = market.vol;
        }
      }
    }

    const aggregated = chainMetrics.reduce((acc, chain) => {
      if (chain.txCount !== null) { acc.totalTxCount += chain.txCount; acc.contributors.txCount++; }
      if (chain.activeAddresses !== null) { acc.totalActiveAddresses += chain.activeAddresses; acc.contributors.activeAddresses++; }
      if (chain.icmMessages !== null) { acc.totalICMMessages += chain.icmMessages; acc.contributors.icmMessages++; }
      acc.totalMarketCap += chain.marketCap ?? 0;
      if (typeof chain.validatorCount === 'number') acc.totalValidators += chain.validatorCount;
      if ((chain.txCount ?? 0) > 0 || (chain.activeAddresses ?? 0) > 0) acc.activeChains++;
      return acc;
    }, {
      totalTxCount: 0, totalActiveAddresses: 0, totalICMMessages: 0,
      totalMarketCap: 0, totalValidators: 0, activeChains: 0,
      contributors: { txCount: 0, activeAddresses: 0, icmMessages: 0 },
    });

    const covered = chainMetrics.filter((c) => c.txCount !== null || c.activeAddresses !== null).length;

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      coverage: { indexed: covered, total: chainMetrics.length },
      aggregated: {
        ...aggregated,
        totalTps: aggregated.totalTxCount / TIME_RANGE_CONFIG[timeRange].secondsInRange,
        activeL1Count: (await getActiveL1CountFromPChain()) ?? chainMetrics.length,
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
