import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { TimeSeriesDataPoint, TimeSeriesMetric, STATS_CONFIG, getTimestampsFromTimeRange, createTimeSeriesMetric } from "@/types/stats";

export const dynamic = 'force-dynamic';
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

const avalanche = new Avalanche({ network: "mainnet" });

interface PrimaryNetworkMetrics {
  validator_count: TimeSeriesMetric;
  validator_weight: TimeSeriesMetric;
  delegator_count: TimeSeriesMetric;
  delegator_weight: TimeSeriesMetric;
  validator_versions: string;
  last_updated: number;
}

const getRlToken = () => process.env.METRICS_BYPASS_TOKEN || '';

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

    const rlToken = getRlToken();
    const params: any = {
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      pageSize,
    };

    if (rlToken) params.rltoken = rlToken;
    
    const result = await avalanche.metrics.networks.getStakingMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        continue;
      }
      allResults = allResults.concat(page.result.results);
      if (!fetchAllPages) break;
    }

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
    const result = await avalanche.data.primaryNetwork.getNetworkDetails({});
    
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

async function fetchFreshDataInternal(timeRange: string): Promise<PrimaryNetworkMetrics | null> {
  try {
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;

    const [
      validatorCountData,
      validatorWeightData,
      delegatorCountData,
      delegatorWeightData,
      validatorVersions
    ] = await Promise.all([
      getTimeSeriesData('validatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('validatorWeight', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorWeight', timeRange, pageSize, fetchAllPages),
      fetchValidatorVersions()
    ]);

    const metrics: PrimaryNetworkMetrics = {
      validator_count: createTimeSeriesMetric(validatorCountData),
      validator_weight: createTimeSeriesMetric(validatorWeightData),
      delegator_count: createTimeSeriesMetric(delegatorCountData),
      delegator_weight: createTimeSeriesMetric(delegatorWeightData),
      validator_versions: JSON.stringify(validatorVersions),
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
      
      return createResponse(cached.data, { 
        source: 'stale-while-revalidate', 
        timeRange, 
        cacheAge 
      });
    }
    
    // Return valid cache
    if (isCacheValid && cached) {
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
        return createResponse(fallbackCached.data, { 
          source: 'fallback-cache', 
          timeRange: '30d',
          cacheAge: Date.now() - fallbackCached.timestamp
        }, 206);
      }
      return createResponse({ error: 'Failed to fetch primary network stats' }, { source: 'error' }, 500);
    }
    
    // Cache fresh data
    cachedData.set(timeRange, { data: freshData, timestamp: Date.now() });
    
    return createResponse(freshData, { 
      source: 'fresh', 
      timeRange, 
      fetchTime: Date.now() - startTime 
    });
  } catch (error) {
    console.error('[GET /api/primary-network-stats] Unhandled error:', error);
    
    // Try to return cached data on error
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const cached = cachedData.get(timeRange);
    
    if (cached) {
      return createResponse(cached.data, { 
        source: 'error-fallback-cache', 
        timeRange,
        cacheAge: Date.now() - cached.timestamp
      }, 206);
    }
    
    return createResponse({ error: 'Failed to fetch primary network stats' }, { source: 'error' }, 500);
  }
}
