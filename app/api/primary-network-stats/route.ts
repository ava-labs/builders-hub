import { NextResponse } from 'next/server';
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { TimeSeriesDataPoint, TimeSeriesMetric, STATS_CONFIG, getTimestampsFromTimeRange, createTimeSeriesMetric } from "@/types/stats";

export const dynamic = 'force-dynamic';
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 10000;

// The staking time-series (validator/delegator count + weight, rewards) all
// come from our own metrics-api — reconstructed over the full chain history
// from decoded_p_txs / reward UTXOs and served gateway-shaped at
// /v2/networks/mainnet/metrics/*. No external data sources.

interface PrimaryNetworkMetrics {
  validator_count: TimeSeriesMetric;
  validator_weight: TimeSeriesMetric;
  delegator_count: TimeSeriesMetric;
  delegator_weight: TimeSeriesMetric;
  validator_versions: string;
  daily_rewards?: TimeSeriesMetric;
  cumulative_rewards?: TimeSeriesMetric;
  last_updated: number;
}

// Timeout wrapper for fetch requests
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}


// Cache storage with stale-while-revalidate pattern
const cachedData = new Map<string, { data: PrimaryNetworkMetrics; timestamp: number }>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<PrimaryNetworkMetrics | null>>();

async function getTimeSeriesData(
  metricType: string, 
  timeRange: string, 
  pageSize: number = 365, 
  fetchAllPages: boolean = false
): Promise<TimeSeriesDataPoint[]> {
  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];

    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({
        startTimestamp: String(startTimestamp),
        endTimestamp: String(endTimestamp),
        pageSize: String(pageSize),
      });
      if (pageToken) qs.set('pageToken', pageToken);
      const res = await fetchWithTimeout(`${EXPLORER_API_BASE}/v2/networks/mainnet/metrics/${metricType}?${qs.toString()}`);
      if (!res.ok) break;
      const page = await res.json();
      if (Array.isArray(page?.results)) allResults = allResults.concat(page.results);
      pageToken = fetchAllPages ? page?.nextPageToken : undefined;
    } while (pageToken);

    return allResults
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn(`[getTimeSeriesData] Failed for ${metricType}:`, error);
    return [];
  }
}

async function fetchValidatorVersions() {
  try {
    // Version distribution from our own P-chain read API (network overview),
    // not Glacier's data.primaryNetwork.getNetworkDetails.
    const detailsRes = await fetchWithTimeout(`${EXPLORER_API_BASE}/v1/networks/mainnet`);
    if (!detailsRes.ok) return {};
    const result = await detailsRes.json();

    if (!result?.validatorDetails?.stakingDistributionByVersion) {
      console.warn('[fetchValidatorVersions] No stakingDistributionByVersion found');
      return {};
    }

    const versionData: { [key: string]: { validatorCount: number; amountStaked: string } } = {};
    result.validatorDetails.stakingDistributionByVersion.forEach((item: any) => {
      if (item.version && item.validatorCount) {
        versionData[item.version] = {
          validatorCount: item.validatorCount,
          amountStaked: item.amountStaked
        };
      }
    });

    return versionData;
  } catch (error) {
    console.error('[fetchValidatorVersions] Error:', error);
    return {};
  }
}

interface RewardsData {
  daily: TimeSeriesDataPoint[];
  cumulative: TimeSeriesDataPoint[];
}

// Rewards paid per day + cumulative, from our metrics-api (reconstructed from
// reward UTXOs over the full chain history). Values are AVAX.
async function fetchRewardsSeries(metric: string): Promise<TimeSeriesDataPoint[]> {
  try {
    const response = await fetchWithTimeout(
      `${EXPLORER_API_BASE}/v2/networks/mainnet/metrics/${metric}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      console.warn(`[fetchRewardsSeries] ${metric}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data?.results)) return [];
    // already newest-first with UTC-midnight timestamps
    return data.results.map((r: { value: number; timestamp: number }) => ({
      timestamp: r.timestamp,
      value: r.value || 0,
      date: new Date(r.timestamp * 1000).toISOString().split('T')[0],
    }));
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn(`[fetchRewardsSeries] ${metric}:`, error);
    }
    return [];
  }
}

async function fetchRewardsData(): Promise<RewardsData> {
  const [daily, cumulative] = await Promise.all([
    fetchRewardsSeries('dailyStakingRewards'),
    fetchRewardsSeries('cumulativeStakingRewards'),
  ]);
  return { daily, cumulative };
}

async function fetchFreshDataInternal(timeRange: string): Promise<PrimaryNetworkMetrics | null> {
  try {
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;

    const [
      validatorCountData,
      validatorWeightData,
      delegatorCountData,
      delegatorWeightData,
      validatorVersions,
      rewardsData
    ] = await Promise.all([
      getTimeSeriesData('validatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('validatorWeight', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorWeight', timeRange, pageSize, fetchAllPages),
      fetchValidatorVersions(),
      fetchRewardsData()
    ]);

    const metrics: PrimaryNetworkMetrics = {
      validator_count: createTimeSeriesMetric(validatorCountData),
      validator_weight: createTimeSeriesMetric(validatorWeightData),
      delegator_count: createTimeSeriesMetric(delegatorCountData),
      delegator_weight: createTimeSeriesMetric(delegatorWeightData),
      validator_versions: JSON.stringify(validatorVersions),
      daily_rewards: createTimeSeriesMetric(rewardsData.daily),
      cumulative_rewards: createTimeSeriesMetric(rewardsData.cumulative),
      last_updated: Date.now()
    };

    return metrics;
  } catch (error) {
    console.error('[fetchFreshData] Failed:', error);
    return null;
  }
}

function createResponse(
  data: PrimaryNetworkMetrics | { error: string },
  meta: { source: string; timeRange?: string; cacheAge?: number; fetchTime?: number },
  status = 200
) {
  const headers: Record<string, string> = { 
    'Cache-Control': CACHE_CONTROL_HEADER, 
    'X-Data-Source': meta.source 
  };
  if (meta.timeRange) headers['X-Time-Range'] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      revalidatingKeys.clear();
    }
    
    const cached = cachedData.get(timeRange);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.SHORT_DURATION;
    const isCacheStale = cached && !isCacheValid;
    
    // Stale-while-revalidate: serve stale data immediately, refresh in background
    if (isCacheStale && !revalidatingKeys.has(timeRange)) {
      revalidatingKeys.add(timeRange);
      
      // Background refresh
      (async () => {
        try {
          const freshData = await fetchFreshDataInternal(timeRange);
          if (freshData) {
            cachedData.set(timeRange, { data: freshData, timestamp: Date.now() });
          }
        } finally {
          revalidatingKeys.delete(timeRange);
        }
      })();
      
      console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: stale-while-revalidate`);
      return createResponse(cached.data, { 
        source: 'stale-while-revalidate', 
        timeRange, 
        cacheAge 
      });
    }
    
    // Return valid cache
    if (isCacheValid && cached) {
      console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: cache`);
      return createResponse(cached.data, { source: 'cache', timeRange, cacheAge });
    }
    
    // Deduplicate pending requests
    const pendingKey = `primary-${timeRange}`;
    let pendingPromise = pendingRequests.get(pendingKey);
    
    if (!pendingPromise) {
      pendingPromise = fetchFreshDataInternal(timeRange);
      pendingRequests.set(pendingKey, pendingPromise);
      pendingPromise.finally(() => pendingRequests.delete(pendingKey));
    }
    
    const startTime = Date.now();
    const freshData = await pendingPromise;
    
    if (!freshData) {
      // Fallback to any available cached data
      const fallbackCached = cachedData.get('30d');
      if (fallbackCached) {
        console.log(`[GET /api/primary-network-stats] TimeRange: 30d, Source: fallback-cache`);
        return createResponse(fallbackCached.data, { 
          source: 'fallback-cache', 
          timeRange: '30d',
          cacheAge: Date.now() - fallbackCached.timestamp
        }, 206);
      }
      console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: error (no data)`);
      return createResponse({ error: 'Failed to fetch primary network stats' }, { source: 'error' }, 500);
    }
    
    // Cache fresh data
    cachedData.set(timeRange, { data: freshData, timestamp: Date.now() });
    
    const fetchTime = Date.now() - startTime;
    console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: fresh, fetchTime: ${fetchTime}ms`);

    return createResponse(freshData, { 
      source: 'fresh', 
      timeRange, 
      fetchTime 
    });
  } catch (error) {
    console.error('[GET /api/primary-network-stats] Unhandled error:', error);
    
    // Try to return cached data on error
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const cached = cachedData.get(timeRange);
    
    if (cached) {
      console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: error-fallback-cache`);
      return createResponse(cached.data, { 
        source: 'error-fallback-cache', 
        timeRange,
        cacheAge: Date.now() - cached.timestamp
      }, 206);
    }
    
    console.log(`[GET /api/primary-network-stats] TimeRange: ${timeRange}, Source: error (no data)`);
    return createResponse({ error: 'Failed to fetch primary network stats' }, { source: 'error' }, 500);
  }
}
