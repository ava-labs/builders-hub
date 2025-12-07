import { NextResponse } from "next/server";
import { Avalanche } from "@avalanche-sdk/chainkit";
import {
  TimeSeriesDataPoint,
  TimeSeriesMetric,
  ICMDataPoint,
  ICMMetric,
  STATS_CONFIG,
  getTimestampsFromTimeRange,
  createTimeSeriesMetric,
  createICMMetric,
} from "@/types/stats";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_CONTROL_HEADER = "public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400";
const getRlToken = () => process.env.METRICS_BYPASS_TOKEN || "";

const avalanche = new Avalanche({ network: "mainnet" });

interface ChainMetrics {
  activeAddresses: {
    daily: TimeSeriesMetric;
    weekly: TimeSeriesMetric;
    monthly: TimeSeriesMetric;
  };
  activeSenders: TimeSeriesMetric;
  cumulativeAddresses: TimeSeriesMetric;
  cumulativeDeployers: TimeSeriesMetric;
  txCount: TimeSeriesMetric;
  cumulativeTxCount: TimeSeriesMetric;
  cumulativeContracts: TimeSeriesMetric;
  contracts: TimeSeriesMetric;
  deployers: TimeSeriesMetric;
  gasUsed: TimeSeriesMetric;
  avgGps: TimeSeriesMetric;
  maxGps: TimeSeriesMetric;
  avgTps: TimeSeriesMetric;
  maxTps: TimeSeriesMetric;
  avgGasPrice: TimeSeriesMetric;
  maxGasPrice: TimeSeriesMetric;
  feesPaid: TimeSeriesMetric;
  icmMessages: ICMMetric;
  last_updated: number;
}

// Cache storage
const cachedData = new Map<
  string,
  { data: ChainMetrics; timestamp: number; icmTimeRange: string }
>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<ChainMetrics | null>>();

// Timeout wrapper for fetch requests
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getTimeSeriesData(
  metricType: string,
  chainId: string,
  timeRange: string,
  startTimestamp?: number,
  endTimestamp?: number,
  pageSize: number = 365,
  fetchAllPages: boolean = false
): Promise<TimeSeriesDataPoint[]> {
  try {
    let finalStartTimestamp: number;
    let finalEndTimestamp: number;

    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      finalStartTimestamp = startTimestamp;
      finalEndTimestamp = endTimestamp;
    } else {
      const timestamps = getTimestampsFromTimeRange(timeRange);
      finalStartTimestamp = timestamps.startTimestamp;
      finalEndTimestamp = timestamps.endTimestamp;
    }

    let allResults: Array<{ timestamp: number; value: number }> = [];
    const rlToken = getRlToken();

    const params: {
      metric: string;
      startTimestamp: number;
      endTimestamp: number;
      timeInterval: string;
      pageSize: number;
      chainId?: string;
      rltoken?: string;
    } = {
      metric: metricType,
      startTimestamp: finalStartTimestamp,
      endTimestamp: finalEndTimestamp,
      timeInterval: "day",
      pageSize,
    };

    params.chainId = chainId === "all" ? "mainnet" : chainId;
    if (rlToken) params.rltoken = rlToken;

    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        continue;
      }
      allResults = allResults.concat(page.result.results);
      if (!fetchAllPages) break;
    }

    return allResults
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((result) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split("T")[0],
      }));
  } catch (error) {
    console.warn(`[getTimeSeriesData] Failed for ${metricType} on chain ${chainId}:`, error);
    return [];
  }
}

async function getActiveAddressesData(
  chainId: string,
  timeRange: string,
  interval: "day" | "week" | "month",
  startTimestampParam?: number,
  endTimestampParam?: number,
  pageSize: number = 365,
  fetchAllPages: boolean = false
): Promise<TimeSeriesDataPoint[]> {
  try {
    let startTimestamp: number;
    let endTimestamp: number;

    if (startTimestampParam !== undefined && endTimestampParam !== undefined) {
      startTimestamp = startTimestampParam;
      endTimestamp = endTimestampParam;
    } else {
      const timestamps = getTimestampsFromTimeRange(timeRange);
      startTimestamp = timestamps.startTimestamp;
      endTimestamp = timestamps.endTimestamp;
    }

    let allResults: Array<{ timestamp: number; value: number }> = [];
    const rlToken = getRlToken();

    const params: {
      metric: string;
      startTimestamp: number;
      endTimestamp: number;
      timeInterval: string;
      pageSize: number;
      chainId?: string;
      rltoken?: string;
    } = {
      metric: "activeAddresses",
      startTimestamp,
      endTimestamp,
      timeInterval: interval,
      pageSize,
    };

    params.chainId = chainId === "all" ? "mainnet" : chainId;
    if (rlToken) params.rltoken = rlToken;

    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        continue;
      }
      allResults = allResults.concat(page.result.results);
      if (!fetchAllPages) break;
    }

    return allResults
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((result) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split("T")[0],
      }));
  } catch (error) {
    console.warn(`[getActiveAddressesData] Failed for chain ${chainId} (${interval}):`, error);
    return [];
  }
}

async function getICMData(
  chainId: string,
  timeRange: string,
  startTimestamp?: number,
  endTimestamp?: number
): Promise<ICMDataPoint[]> {
  try {
    const apiChainId = chainId === "all" ? "global" : chainId;

    let days: number;
    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      const startDate = new Date(startTimestamp * 1000);
      const endDate = new Date(endTimestamp * 1000);
      days = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      const getDaysFromTimeRange = (range: string): number => {
        switch (range) {
          case "7d":
            return 7;
          case "30d":
            return 30;
          case "90d":
            return 90;
          case "all":
            return 365;
          default:
            return 30;
        }
      };
      days = getDaysFromTimeRange(timeRange);
    }

    const response = await fetchWithTimeout(
      `https://idx6.solokhin.com/api/${apiChainId}/metrics/dailyMessageVolume?days=${days}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    interface ICMRawDataPoint {
      timestamp: number;
      date: string;
      messageCount?: number;
      incomingCount?: number;
      outgoingCount?: number;
    }

    let filteredData = (data as ICMRawDataPoint[])
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((item) => ({
        timestamp: item.timestamp,
        date: item.date,
        messageCount: item.messageCount || 0,
        incomingCount: item.incomingCount || 0,
        outgoingCount: item.outgoingCount || 0,
      }));

    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      filteredData = filteredData.filter(
        (item: ICMDataPoint) => item.timestamp >= startTimestamp && item.timestamp <= endTimestamp
      );
    }

    return filteredData;
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError") {
      console.warn(`[getICMData] Failed for chain ${chainId}:`, error);
    }
    return [];
  }
}

const ALL_METRICS = [
  "activeAddresses",
  "activeSenders",
  "cumulativeAddresses",
  "cumulativeDeployers",
  "txCount",
  "cumulativeTxCount",
  "cumulativeContracts",
  "contracts",
  "deployers",
  "gasUsed",
  "avgGps",
  "maxGps",
  "avgTps",
  "maxTps",
  "avgGasPrice",
  "maxGasPrice",
  "feesPaid",
  "icmMessages",
] as const;

type MetricKey = (typeof ALL_METRICS)[number];

async function fetchFreshDataInternal(
  chainId: string,
  timeRange: string,
  requestedMetrics: MetricKey[],
  startTimestamp?: number,
  endTimestamp?: number,
  isSpecificMetricsMode: boolean = false
): Promise<ChainMetrics | null> {
  try {
    const config =
      STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] ||
      STATS_CONFIG.TIME_RANGES["30d"];
    const { pageSize, fetchAllPages } = config;

    const fetchPromises: { [key: string]: Promise<TimeSeriesDataPoint[] | ICMDataPoint[]> } = {};

    // activeAddresses with variants
    if (requestedMetrics.includes("activeAddresses")) {
      fetchPromises["dailyActiveAddresses"] = getActiveAddressesData(
        chainId,
        timeRange,
        "day",
        startTimestamp,
        endTimestamp,
        pageSize,
        fetchAllPages
      );
      if (!isSpecificMetricsMode) {
        fetchPromises["weeklyActiveAddresses"] = getActiveAddressesData(
          chainId,
          timeRange,
          "week",
          startTimestamp,
          endTimestamp,
          pageSize,
          fetchAllPages
        );
        fetchPromises["monthlyActiveAddresses"] = getActiveAddressesData(
          chainId,
          timeRange,
          "month",
          startTimestamp,
          endTimestamp,
          pageSize,
          fetchAllPages
        );
      }
    }

    // Standard metrics
    const standardMetrics: MetricKey[] = [
      "activeSenders",
      "cumulativeAddresses",
      "cumulativeDeployers",
      "txCount",
      "cumulativeTxCount",
      "cumulativeContracts",
      "contracts",
      "deployers",
      "gasUsed",
      "avgGps",
      "maxGps",
      "avgTps",
      "maxTps",
      "avgGasPrice",
      "maxGasPrice",
      "feesPaid",
    ];

    for (const metric of standardMetrics) {
      if (requestedMetrics.includes(metric)) {
        fetchPromises[metric] = getTimeSeriesData(
          metric,
          chainId,
          timeRange,
          startTimestamp,
          endTimestamp,
          pageSize,
          fetchAllPages
        );
      }
    }

    // ICM messages
    if (requestedMetrics.includes("icmMessages")) {
      fetchPromises["icmMessages"] = getICMData(chainId, timeRange, startTimestamp, endTimestamp);
    }

    // Fetch all in parallel
    const fetchKeys = Object.keys(fetchPromises);
    const fetchResults = await Promise.all(Object.values(fetchPromises));

    const results: { [key: string]: TimeSeriesDataPoint[] | ICMDataPoint[] } = {};
    fetchKeys.forEach((key, index) => {
      results[key] = fetchResults[index];
    });

    // Build metrics object
    const metrics: Partial<ChainMetrics> & {
      activeAddresses?:
        | TimeSeriesMetric
        | {
            daily: TimeSeriesMetric;
            weekly: TimeSeriesMetric;
            monthly: TimeSeriesMetric;
          };
    } = {
      last_updated: Date.now(),
    };

    if (requestedMetrics.includes("activeAddresses")) {
      if (isSpecificMetricsMode) {
        metrics.activeAddresses = createTimeSeriesMetric(
          results["dailyActiveAddresses"] as TimeSeriesDataPoint[]
        );
      } else {
        metrics.activeAddresses = {
          daily: createTimeSeriesMetric(results["dailyActiveAddresses"] as TimeSeriesDataPoint[]),
          weekly: createTimeSeriesMetric(results["weeklyActiveAddresses"] as TimeSeriesDataPoint[]),
          monthly: createTimeSeriesMetric(
            results["monthlyActiveAddresses"] as TimeSeriesDataPoint[]
          ),
        };
      }
    }

    // Map standard metrics
    const metricMappings: { key: MetricKey; resultKey: string }[] = [
      { key: "activeSenders", resultKey: "activeSenders" },
      { key: "cumulativeAddresses", resultKey: "cumulativeAddresses" },
      { key: "cumulativeDeployers", resultKey: "cumulativeDeployers" },
      { key: "txCount", resultKey: "txCount" },
      { key: "cumulativeTxCount", resultKey: "cumulativeTxCount" },
      { key: "cumulativeContracts", resultKey: "cumulativeContracts" },
      { key: "contracts", resultKey: "contracts" },
      { key: "deployers", resultKey: "deployers" },
      { key: "gasUsed", resultKey: "gasUsed" },
      { key: "avgGps", resultKey: "avgGps" },
      { key: "maxGps", resultKey: "maxGps" },
      { key: "avgTps", resultKey: "avgTps" },
      { key: "maxTps", resultKey: "maxTps" },
      { key: "avgGasPrice", resultKey: "avgGasPrice" },
      { key: "maxGasPrice", resultKey: "maxGasPrice" },
      { key: "feesPaid", resultKey: "feesPaid" },
    ];

    for (const mapping of metricMappings) {
      if (requestedMetrics.includes(mapping.key) && results[mapping.resultKey]) {
        (metrics as Record<string, TimeSeriesMetric>)[mapping.key] = createTimeSeriesMetric(
          results[mapping.resultKey] as TimeSeriesDataPoint[]
        );
      }
    }

    if (requestedMetrics.includes("icmMessages") && results["icmMessages"]) {
      metrics.icmMessages = createICMMetric(results["icmMessages"] as ICMDataPoint[]);
    }

    return metrics as ChainMetrics;
  } catch (error) {
    console.error(`[fetchFreshData] Failed for chain ${chainId}:`, error);
    return null;
  }
}

function createResponse(
  data: ChainMetrics | Partial<ChainMetrics> | { error: string; details?: string },
  meta: {
    source: string;
    chainId?: string;
    timeRange?: string;
    cacheAge?: number;
    fetchTime?: number;
    metrics?: string;
  },
  status = 200
) {
  const headers: Record<string, string> = {
    "Cache-Control": CACHE_CONTROL_HEADER,
    "X-Data-Source": meta.source,
  };
  if (meta.chainId) headers["X-Chain-Id"] = meta.chainId;
  if (meta.timeRange) headers["X-Time-Range"] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers["X-Cache-Age"] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers["X-Fetch-Time"] = `${meta.fetchTime}ms`;
  if (meta.metrics) headers["X-Metrics"] = meta.metrics;
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ chainId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "30d";
    const startTimestampParam = searchParams.get("startTimestamp");
    const endTimestampParam = searchParams.get("endTimestamp");
    const metricsParam = searchParams.get("metrics");
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;

    if (!chainId) {
      return createResponse({ error: "Chain ID is required" }, { source: "error" }, 400);
    }

    // Parse timestamps
    const startTimestamp = startTimestampParam ? parseInt(startTimestampParam, 10) : undefined;
    const endTimestamp = endTimestampParam ? parseInt(endTimestampParam, 10) : undefined;

    // Validate timestamps
    if (startTimestamp !== undefined && isNaN(startTimestamp)) {
      return createResponse(
        { error: "Invalid startTimestamp parameter" },
        { source: "error" },
        400
      );
    }
    if (endTimestamp !== undefined && isNaN(endTimestamp)) {
      return createResponse({ error: "Invalid endTimestamp parameter" }, { source: "error" }, 400);
    }
    if (
      startTimestamp !== undefined &&
      endTimestamp !== undefined &&
      startTimestamp > endTimestamp
    ) {
      return createResponse(
        { error: "startTimestamp must be less than or equal to endTimestamp" },
        { source: "error" },
        400
      );
    }

    // Parse requested metrics
    const requestedMetrics: MetricKey[] = metricsParam
      ? metricsParam.split(",").filter((m): m is MetricKey => ALL_METRICS.includes(m as MetricKey))
      : [...ALL_METRICS];

    if (metricsParam && requestedMetrics.length === 0) {
      return createResponse(
        { error: "Invalid metrics parameter. Valid metrics: " + ALL_METRICS.join(", ") },
        { source: "error" },
        400
      );
    }

    const isSpecificMetricsMode = metricsParam !== null;
    const metricsKey = requestedMetrics.sort().join(",");
    const cacheKey =
      startTimestamp !== undefined && endTimestamp !== undefined
        ? `${chainId}-${startTimestamp}-${endTimestamp}-${metricsKey}`
        : `${chainId}-${timeRange}-${metricsKey}`;

    if (searchParams.get("clearCache") === "true") {
      cachedData.clear();
      revalidatingKeys.clear();
    }

    const cached = cachedData.get(cacheKey);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const isCacheValid = cacheAge < STATS_CONFIG.CACHE.LONG_DURATION;
    const isCacheStale = cached && !isCacheValid;

    // Stale-while-revalidate: serve stale data immediately, refresh in background
    if (isCacheStale && !revalidatingKeys.has(cacheKey)) {
      revalidatingKeys.add(cacheKey);

      // Background refresh
      (async () => {
        try {
          const freshData = await fetchFreshDataInternal(
            chainId,
            timeRange,
            requestedMetrics,
            startTimestamp,
            endTimestamp,
            isSpecificMetricsMode
          );
          if (freshData) {
            cachedData.set(cacheKey, {
              data: freshData,
              timestamp: Date.now(),
              icmTimeRange: timeRange,
            });
          }
        } finally {
          revalidatingKeys.delete(cacheKey);
        }
      })();

      console.log(
        `[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: stale-while-revalidate`
      );
      return createResponse(cached.data, {
        source: "stale-while-revalidate",
        chainId,
        timeRange,
        cacheAge,
        metrics: metricsKey,
      });
    }

    // Return valid cache
    if (isCacheValid && cached) {
      // Refresh ICM if timeRange changed
      if (
        requestedMetrics.includes("icmMessages") &&
        startTimestamp === undefined &&
        endTimestamp === undefined &&
        cached.icmTimeRange !== timeRange
      ) {
        try {
          const newICMData = await getICMData(chainId, timeRange);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = timeRange;
          cachedData.set(cacheKey, cached);
        } catch (error) {
          console.warn("[GET] Failed to refresh ICM data:", error);
        }
      }

      console.log(`[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: cache`);
      return createResponse(cached.data, {
        source: "cache",
        chainId,
        timeRange,
        cacheAge,
        metrics: metricsKey,
      });
    }

    // Deduplicate pending requests
    const pendingKey = cacheKey;
    let pendingPromise = pendingRequests.get(pendingKey);

    if (!pendingPromise) {
      pendingPromise = fetchFreshDataInternal(
        chainId,
        timeRange,
        requestedMetrics,
        startTimestamp,
        endTimestamp,
        isSpecificMetricsMode
      );
      pendingRequests.set(pendingKey, pendingPromise);
      pendingPromise.finally(() => pendingRequests.delete(pendingKey));
    }

    const startTime = Date.now();
    const freshData = await pendingPromise;

    if (!freshData) {
      // Fallback to any available cached data
      const fallbackCacheKey = `${chainId}-30d-${metricsKey}`;
      const fallbackCached = cachedData.get(fallbackCacheKey);
      if (fallbackCached) {
        console.log(`[GET /api/chain-stats/${chainId}] TimeRange: 30d, Source: fallback-cache`);
        return createResponse(
          fallbackCached.data,
          {
            source: "fallback-cache",
            chainId,
            timeRange: "30d",
            cacheAge: Date.now() - fallbackCached.timestamp,
            metrics: metricsKey,
          },
          206
        );
      }
      console.log(
        `[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: error (no data)`
      );
      return createResponse(
        { error: "Failed to fetch chain metrics" },
        { source: "error", chainId },
        500
      );
    }

    // Cache fresh data
    cachedData.set(cacheKey, {
      data: freshData,
      timestamp: Date.now(),
      icmTimeRange: timeRange,
    });

    const fetchTime = Date.now() - startTime;
    console.log(
      `[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: fresh, fetchTime: ${fetchTime}ms`
    );

    return createResponse(freshData, {
      source: "fresh",
      chainId,
      timeRange,
      fetchTime,
      metrics: metricsKey,
    });
  } catch (error) {
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;
    console.error(`[GET /api/chain-stats/${chainId}] Unhandled error:`, error);
    return createResponse(
      {
        error: "Failed to fetch chain metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { source: "error", chainId },
      500
    );
  }
}
