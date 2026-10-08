import { NextResponse } from 'next/server';
import { STATS_CONFIG } from "@/types/stats";
import { getChainICMCount } from "@/lib/icm-clickhouse";
import { DEDICATED_STATS_BASE_URL, toStatsChainId } from "@/lib/dedicated-stats";
import { pchainPost } from "@/lib/pchain-rpc";
import { latestComplete, sumComplete } from "@/lib/stats-windows";
import { fetchAllSubnets, fetchSubnetsById, runningL1Count, type RegistrySubnet } from "@/lib/pchain-subnets";
import { fetchIndexedChainIds } from "@/lib/stats-coverage";
import { isPchainNetwork, type PchainNetwork } from "@/lib/pchain-explorer";
import { activeChains } from "@/lib/explorer-catalog";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";

export const dynamic = 'force-dynamic';

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_CHAINS = 10;
const STATS_API_URL = DEDICATED_STATS_BASE_URL;

// P-Chain is the authority on how many L1s exist, and it answers for every
// subnet whether or not we index it. Chain *counts* must come from here, not
// from how many chains we happen to have figures for (lib/pchain-rpc.ts).
// A "network" param ("mainnet", the default, or "fuji") picks the chains and
// the P-Chain; every cache below keys by it.

// days = daily buckets to pull from the stats API (the window and a 2-day
// buffer). "day" reads hourly buckets instead: the explorer labels it
// "24 hours", so it sums the last 24 complete hours. secondsInRange divides
// the summed txCount into tps and gives the number of buckets to sum: one
// source of truth per range.
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

/**
 * How many L1s are live on the network, straight from P-Chain.
 *
 * `getAllValidatorsAt` at height `proposed` returns the validator set per
 * subnet, and a subnet with a non-empty set is running. Deliberately not
 * `getCurrentValidators`: that lists registered validators regardless of state,
 * so under ACP-77 it reports healthy-looking sets for chains whose L1 validators
 * have run out of fee balance. The running sets are the ones
 * scripts/enrich-chains.ts marks isActive; legacy subnets (gunz, StepNetwork)
 * run sets too, so the count keeps only the subnets the subnet list marks
 * isL1, as /api/validator-stats and /api/l1-registry's totals.activeL1s do.
 *
 * Returns null if P-Chain is unreachable; the caller falls back rather than
 * publishing a count it did not verify.
 */
const l1CountCache = new Map<PchainNetwork, { counts: Map<string, number>; at: number }>();
// one P-Chain read per network at a time: every chain's row asks for the sets at once
const pendingSets = new Map<PchainNetwork, Promise<Map<string, number> | null>>();

async function getPChainValidatorCounts(network: PchainNetwork): Promise<Map<string, number> | null> {
  const fresh = await loadPChainValidatorSets(network);
  return fresh;
}

async function getActiveL1CountFromPChain(network: PchainNetwork): Promise<number | null> {
  const sets = loadPChainValidatorSets(network);
  // mainnet reads its subnet list beside the sets; Fuji names the sets it gets
  const [counts, subnets] = await Promise.all([
    sets,
    network === 'fuji' ? sets.then((c) => (c ? loadSubnets(network, c) : null)) : loadSubnets(network, null),
  ]);
  if (!counts || !subnets) return null;
  return runningL1Count(counts, subnets);
}

// the subnet list moves only when a subnet is created or converted: read
// hourly, the last good list kept through a failure. Fuji has ~8,000 subnets
// (80 pages), so it names only its running sets, by ID, on each read: those
// reads keep their own hour cache, and a set that starts running counts at once.
const SUBNETS_TTL_MS = 60 * 60 * 1000;
const subnetsCache = new Map<PchainNetwork, { subnets: RegistrySubnet[]; at: number }>();

async function loadSubnets(network: PchainNetwork, counts: Map<string, number> | null): Promise<RegistrySubnet[] | null> {
  const hit = subnetsCache.get(network);
  if (network === 'mainnet' && hit && Date.now() - hit.at < SUBNETS_TTL_MS) return hit.subnets;
  try {
    const running = [...(counts?.keys() ?? [])].filter((id) => id !== PRIMARY_SUBNET_ID);
    const subnets = network === 'fuji' ? await fetchSubnetsById(network, running) : await fetchAllSubnets(network);
    if (network === 'fuji' && running.length > 0 && subnets.length === 0) throw new Error('no fuji subnet answered');
    subnetsCache.set(network, { subnets, at: Date.now() });
    return subnets;
  } catch (error) {
    console.error(`[loadSubnets] ${network} failed:`, error);
    return hit?.subnets ?? null;
  }
}

function loadPChainValidatorSets(network: PchainNetwork): Promise<Map<string, number> | null> {
  const hit = l1CountCache.get(network);
  if (hit && Date.now() - hit.at < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return Promise.resolve(hit.counts);
  }
  let pending = pendingSets.get(network);
  if (!pending) {
    pending = readPChainValidatorSets(network);
    pendingSets.set(network, pending);
    void pending.finally(() => pendingSets.delete(network));
  }
  return pending;
}

async function readPChainValidatorSets(network: PchainNetwork): Promise<Map<string, number> | null> {
  try {
    const res = await pchainPost(network, {
      jsonrpc: '2.0', id: 1,
      method: 'platform.getAllValidatorsAt',
      params: { height: 'proposed' },
    }, REQUEST_TIMEOUT_MS);
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
    l1CountCache.set(network, { counts, at: Date.now() });
    return counts;
  } catch (error) {
    console.error(`[loadPChainValidatorSets] ${network} failed:`, error);
    // a busy or rate-limited P-Chain serves the last good sets rather than none,
    // so the city keeps its buildings through a 429
    return l1CountCache.get(network)?.counts ?? null;
  }
}

/** the network's active catalog chains: the testnet ones for Fuji */
function getAllChains(network: PchainNetwork): ChainInfo[] {
  return activeChains({ testnet: network === 'fuji' }).map(chain => ({
    chainId: chain.chainId,
    chainName: chain.chainName,
    logoUri: chain.chainLogoURI || '',
    subnetId: chain.subnetId,
    ...(chain.coingeckoId ? { coingeckoId: chain.coingeckoId } : {}),
  }));
}

async function getTxCountData(chainId: string, timeRange: TimeRangeKey): Promise<Metric> {
  try {
    const config = TIME_RANGE_CONFIG[timeRange];
    const hourly = timeRange === 'day';
    const endTimestamp = Math.floor(Date.now() / 1000);
    // the day's 24 hours and a 2-hour buffer, or the window's days and their buffer
    const span = hourly ? config.secondsInRange / SECONDS_PER_HOUR + 2 : config.days;
    const startTimestamp = endTimestamp - span * (hourly ? SECONDS_PER_HOUR : SECONDS_PER_DAY);

    const url = new URL(`${STATS_API_URL}/v2/chains/${toStatsChainId(chainId)}/metrics/txCount`);
    url.searchParams.set('timeInterval', hourly ? 'hour' : 'day');
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', String(span + 1));

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      if (isNotTracked(res.status)) return NO_DATA;
      throw new Error(`metrics-api ${res.status}`);
    }
    const data = await res.json();

    // every stored bucket is a complete period: the newest counts too
    const results: MetricResult[] = data.results || [];
    const sum = hourly
      ? sumComplete(results, 'hour', config.secondsInRange / SECONDS_PER_HOUR, endTimestamp)
      : sumComplete(results, 'day', config.secondsInRange / SECONDS_PER_DAY, endTimestamp);
    return sum === null ? NO_DATA : { v: sum, ok: true };
  } catch (error) {
    console.error(`[getTxCountData] Failed for chain ${chainId}:`, error);
    return UNAVAILABLE;
  }
}

async function getActiveAddressesData(chainId: string, timeRange: TimeRangeKey): Promise<Metric> {
  try {
    const endTimestamp = Math.floor(Date.now() / 1000);

    // active addresses is a distinct count, not a sum: the API only buckets it
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

    // a distinct count, so one bucket: the latest complete period's, never an older one
    const dataPoint = latestComplete(data.results || [], interval, endTimestamp);
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

async function getValidatorCount(subnetId: string, network: PchainNetwork): Promise<number | string> {
  if (!subnetId || subnetId === "N/A") return "N/A";
  const counts = await getPChainValidatorCounts(network);
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

/** one chain's row; a chain stats-api does not index (indexed false) gets no figures and costs no request */
async function fetchChainMetrics(chain: ChainInfo, timeRange: TimeRangeKey, network: PchainNetwork, indexed: boolean): Promise<ChainOverviewMetrics | null> {
  const cacheKey = `${network}:${chain.chainId}-${timeRange}`;
  const cached = chainDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return cached.data;
  }

  try {
    const [txCount, activeAddresses, icmMessages, validatorCount] = await Promise.all([
      indexed ? getTxCountData(chain.chainId, timeRange) : NO_DATA,
      indexed ? getActiveAddressesData(chain.chainId, timeRange) : NO_DATA,
      indexed ? getICMData(chain.chainId, timeRange) : NO_DATA,
      getValidatorCount(chain.subnetId, network),
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

// the last indexed list stats-api gave: a read that does not answer keeps it,
// and with none, Fuji asks no chain rather than ~170 that fail
let lastFujiIndexedIds: Set<string> | null = null;

async function loadFujiIndexedIds(): Promise<Set<string>> {
  const fresh = await fetchIndexedChainIds();
  if (fresh) lastFujiIndexedIds = fresh;
  return lastFujiIndexedIds ?? new Set();
}

async function fetchFreshDataInternal(timeRange: TimeRangeKey, network: PchainNetwork): Promise<OverviewMetrics | null> {
  try {
    const startTime = Date.now();
    const allChains = getAllChains(network);
    // stats-api indexes 3 of Fuji's ~170 chains, and each other chain would
    // cost two failing requests. Mainnet asks for every chain.
    const indexedIds = network === 'fuji' ? await loadFujiIndexedIds() : null;
    const isIndexed = (chain: ChainInfo) => !indexedIds || indexedIds.has(toStatsChainId(chain.chainId));

    // testnet tokens have no market price, and the market cap cache holds mainnet's
    const [chainResults, marketCaps] = await Promise.all([
      processInBatches(allChains, (chain) => fetchChainMetrics(chain, timeRange, network, isIndexed(chain)), MAX_CONCURRENT_CHAINS),
      network === 'mainnet' ? fetchMarketCaps(allChains) : Promise.resolve<Record<string, TokenMarketData>>({}),
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
        activeL1Count: (await getActiveL1CountFromPChain(network)) ?? chainMetrics.length,
      },
      timeRange,
      last_updated: Date.now()
    };

    cachedData.set(`${network}:${timeRange}`, { data: metrics, timestamp: Date.now() });
    console.log(`[fetchFreshData] ${network} completed in ${Date.now() - startTime}ms, ${chainMetrics.length}/${allChains.length} chains`);
    return metrics;
  } catch (error) {
    console.error('[fetchFreshData] Failed:', error);
    return null;
  }
}

async function fetchFreshData(timeRange: TimeRangeKey, network: PchainNetwork): Promise<{ data: OverviewMetrics; fetchTime: number; chainCount: number } | null> {
  const startTime = Date.now();
  const pendingKey = `fresh-${network}-${timeRange}`;
  let pendingPromise = pendingRequests.get(pendingKey);
  
  if (!pendingPromise) {
    pendingPromise = fetchFreshDataInternal(timeRange, network);
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
  // an error is not kept, by a CDN or the browser
  const headers: Record<string, string> = { 'Cache-Control': status >= 400 ? 'no-store' : CACHE_CONTROL_HEADER, 'X-Data-Source': meta.source };
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
    const network = searchParams.get('network') ?? 'mainnet';
    if (!isPchainNetwork(network)) {
      return createResponse({ error: `unknown network '${network}'` }, { source: 'error' }, 400);
    }
    const key = `${network}:${timeRange}`;
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      chainDataCache.clear();
      revalidatingKeys.clear();
    }
    
    const cached = cachedData.get(key);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.SHORT_DURATION;
    const isCacheStale = cached && !isCacheValid;
    
    if (isCacheStale && !revalidatingKeys.has(key)) {
      revalidatingKeys.add(key);
      fetchFreshData(timeRange, network).finally(() => revalidatingKeys.delete(key));
      return createResponse(cached.data, { source: 'stale-while-revalidate', timeRange, cacheAge });
    }
    
    if (isCacheValid && cached) {
      return createResponse(cached.data, { source: 'cache', timeRange, cacheAge });
    }
    
    const freshData = await fetchFreshData(timeRange, network);
    if (!freshData) {
      return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error' }, 500);
    }
    
    return createResponse(freshData.data, { source: 'fresh', timeRange, fetchTime: freshData.fetchTime, chainCount: freshData.chainCount });
  } catch (error) {
    console.error('[GET /api/overview-stats] Unhandled error:', error);
    return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error' }, 500);
  }
}
