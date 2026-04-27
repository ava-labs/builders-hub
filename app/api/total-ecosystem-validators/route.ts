import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";
import {
  TimeSeriesDataPoint,
  TimeSeriesMetric,
  STATS_CONFIG,
  getTimestampsFromTimeRange,
  createTimeSeriesMetric,
} from "@/types/stats";

export const dynamic = 'force-dynamic';

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const MAX_CONCURRENT_REQUESTS = 10;

// l1-chains.json includes the Primary Network subnet ID (C-Chain entry). The
// Primary Network series is fetched separately; exclude it from the L1 loop to
// avoid double-counting.
const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

const avalanche = new Avalanche({ network: "mainnet" });
const getRlToken = () => process.env.METRICS_BYPASS_TOKEN || '';

// Sum of per-network validatorCount series, i.e. total validator *seats* (a
// node validating N networks is counted N times). Computing distinct node
// counts historically would require per-date node-ID snapshots for every
// subnet, which Glacier does not expose cheaply.
interface TotalEcosystemValidatorsResponse {
  total_validator_seats: TimeSeriesMetric;
  l1_validator_seats: TimeSeriesMetric;
  primary_network_validator_count: TimeSeriesMetric;
  subnets_included: number;
  last_updated: number;
}

const cachedData = new Map<string, { data: TotalEcosystemValidatorsResponse; timestamp: number }>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<TotalEcosystemValidatorsResponse | null>>();

function getActiveMainnetSubnetIds(): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const chain of l1ChainsData as any[]) {
    if (chain.isTestnet === true) continue;
    if (chain.isActive === false) continue;
    if (!chain.subnetId || chain.subnetId === 'N/A') continue;
    if (chain.subnetId === PRIMARY_NETWORK_SUBNET_ID) continue;
    if (seen.has(chain.subnetId)) continue;
    seen.add(chain.subnetId);
    ids.push(chain.subnetId);
  }
  return ids;
}

// Returns null on fetch failure so callers can distinguish a real fetch error
// (e.g. Glacier transient) from a successfully fetched empty series. Treating
// failures as [] silently turns missing L1 validator seats into zeros and
// poisons the cache.
async function fetchValidatorCountSeries(
  subnetId: string | undefined,
  startTimestamp: number,
  endTimestamp: number,
  pageSize: number,
  fetchAllPages: boolean,
): Promise<TimeSeriesDataPoint[] | null> {
  try {
    const rlToken = getRlToken();
    const params: any = {
      metric: 'validatorCount' as any,
      startTimestamp,
      endTimestamp,
      pageSize,
    };
    if (subnetId) params.subnetId = subnetId;
    if (rlToken) params.rltoken = rlToken;

    const result = await avalanche.metrics.networks.getStakingMetrics(params);

    const all: any[] = [];
    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) continue;
      all.push(...page.result.results);
      if (!fetchAllPages) break;
    }

    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((r: any) => ({
        timestamp: r.timestamp,
        value: r.value || 0,
        date: new Date(r.timestamp * 1000).toISOString().split('T')[0],
      }));
  } catch (error) {
    console.warn(`[total-ecosystem-validators] Failed for subnet ${subnetId ?? 'primary'}:`, error);
    return null;
  }
}

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

function sumSeriesByDate(seriesList: TimeSeriesDataPoint[][]): TimeSeriesDataPoint[] {
  const totals = new Map<string, { timestamp: number; value: number }>();
  for (const series of seriesList) {
    for (const point of series) {
      const numeric = typeof point.value === 'string' ? parseFloat(point.value) : point.value;
      if (!Number.isFinite(numeric)) continue;
      const existing = totals.get(point.date);
      if (existing) {
        existing.value += numeric;
      } else {
        totals.set(point.date, { timestamp: point.timestamp, value: numeric });
      }
    }
  }
  return Array.from(totals.entries())
    .map(([date, { timestamp, value }]) => ({ date, timestamp, value }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

// If more than this fraction of L1 subnet fetches fail, treat the whole
// response as unreliable and return null so the route falls back to stale
// cached data instead of caching a partial total as fresh.
const L1_FETCH_FAILURE_TOLERANCE = 0.5;

async function fetchFreshDataInternal(timeRange: string): Promise<TotalEcosystemValidatorsResponse | null> {
  try {
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES]
      || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);

    const subnetIds = getActiveMainnetSubnetIds();

    const [primarySeries, l1SeriesList] = await Promise.all([
      fetchValidatorCountSeries(undefined, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      processInBatches(
        subnetIds,
        (subnetId) =>
          fetchValidatorCountSeries(subnetId, startTimestamp, endTimestamp, pageSize, fetchAllPages),
        MAX_CONCURRENT_REQUESTS,
      ),
    ]);

    if (primarySeries === null) {
      console.warn('[total-ecosystem-validators] Primary Network fetch failed; falling back to cache.');
      return null;
    }

    const successfulL1Series: TimeSeriesDataPoint[][] = [];
    let failedL1Count = 0;
    for (const series of l1SeriesList) {
      if (series === null) failedL1Count += 1;
      else successfulL1Series.push(series);
    }

    if (
      subnetIds.length > 0 &&
      failedL1Count / subnetIds.length > L1_FETCH_FAILURE_TOLERANCE
    ) {
      console.warn(
        `[total-ecosystem-validators] ${failedL1Count}/${subnetIds.length} L1 fetches failed; falling back to cache.`,
      );
      return null;
    }

    const l1Totals = sumSeriesByDate(successfulL1Series);
    const grandTotals = sumSeriesByDate([primarySeries, l1Totals]);

    return {
      total_validator_seats: createTimeSeriesMetric(grandTotals),
      l1_validator_seats: createTimeSeriesMetric(l1Totals),
      primary_network_validator_count: createTimeSeriesMetric(primarySeries),
      subnets_included: subnetIds.length - failedL1Count,
      last_updated: Date.now(),
    };
  } catch (error) {
    console.error('[total-ecosystem-validators] fetchFreshData failed:', error);
    return null;
  }
}

function createResponse(
  data: TotalEcosystemValidatorsResponse | { error: string },
  meta: { source: string; timeRange?: string; cacheAge?: number; fetchTime?: number },
  status = 200,
) {
  const headers: Record<string, string> = {
    'Cache-Control': CACHE_CONTROL_HEADER,
    'X-Data-Source': meta.source,
  };
  if (meta.timeRange) headers['X-Time-Range'] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';

    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      revalidatingKeys.clear();
    }

    const cached = cachedData.get(timeRange);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.LONG_DURATION;
    const isCacheStale = cached && !isCacheValid;

    if (isCacheStale && cached) {
      if (!revalidatingKeys.has(timeRange)) {
        revalidatingKeys.add(timeRange);
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
      }
      return createResponse(cached.data, { source: 'stale-while-revalidate', timeRange, cacheAge });
    }

    if (isCacheValid && cached) {
      return createResponse(cached.data, { source: 'cache', timeRange, cacheAge });
    }

    const pendingKey = `total-${timeRange}`;
    let pendingPromise = pendingRequests.get(pendingKey);
    if (!pendingPromise) {
      pendingPromise = fetchFreshDataInternal(timeRange);
      pendingRequests.set(pendingKey, pendingPromise);
      pendingPromise.finally(() => pendingRequests.delete(pendingKey));
    }

    const startTime = Date.now();
    const freshData = await pendingPromise;

    if (!freshData) {
      const fallbackCached = cached ?? cachedData.get(timeRange);
      if (fallbackCached) {
        return createResponse(
          fallbackCached.data,
          {
            source: 'error-fallback-cache',
            timeRange,
            cacheAge: Date.now() - fallbackCached.timestamp,
          },
          206,
        );
      }
      return createResponse(
        { error: 'Failed to fetch total ecosystem validator stats' },
        { source: 'error' },
        500,
      );
    }

    cachedData.set(timeRange, { data: freshData, timestamp: Date.now() });
    const fetchTime = Date.now() - startTime;
    return createResponse(freshData, { source: 'fresh', timeRange, fetchTime });
  } catch (error) {
    console.error('[GET /api/total-ecosystem-validators] Unhandled error:', error);
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    const cached = cachedData.get(timeRange);
    if (cached) {
      return createResponse(
        cached.data,
        {
          source: 'error-fallback-cache',
          timeRange,
          cacheAge: Date.now() - cached.timestamp,
        },
        206,
      );
    }
    return createResponse(
      { error: 'Failed to fetch total ecosystem validator stats' },
      { source: 'error' },
      500,
    );
  }
}
