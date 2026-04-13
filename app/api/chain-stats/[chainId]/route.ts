import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api';
import {
  TimeSeriesDataPoint,
  TimeSeriesMetric,
  ICMDataPoint,
  ICMMetric,
  STATS_CONFIG,
  getTimestampsFromTimeRange,
  createTimeSeriesMetric,
  createICMMetric,
} from '@/types/stats';
import { getChainICMData } from '@/lib/icm-clickhouse';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const METRICS_API_URL = process.env.METRICS_API_URL;

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
  dailyRewards?: TimeSeriesMetric;
  cumulativeRewards?: TimeSeriesMetric;
  // Primary Network specific metrics
  netCumulativeEmissions?: TimeSeriesMetric;
  netEmissionsDaily?: TimeSeriesMetric;
  cumulativeBurn?: TimeSeriesMetric;
  totalBurnDaily?: TimeSeriesMetric;
  cChainFeesDaily?: TimeSeriesMetric;
  pChainFeesDaily?: TimeSeriesMetric;
  xChainFeesDaily?: TimeSeriesMetric;
  validatorFeesDaily?: TimeSeriesMetric;
  cumulativeCChainFees?: TimeSeriesMetric;
  cumulativePChainFees?: TimeSeriesMetric;
  cumulativeXChainFees?: TimeSeriesMetric;
  cumulativeValidatorFees?: TimeSeriesMetric;
  last_updated: number;
}

// Cache storage
const cachedData = new Map<string, { data: ChainMetrics; timestamp: number; icmTimeRange: string }>();
const revalidatingKeys = new Set<string>();
const pendingRequests = new Map<string, Promise<ChainMetrics | null>>();

// Timeout wrapper for fetch requests
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMetricsApi(
  chainId: string,
  metric: string,
  timeInterval: string,
  startTimestamp: number,
  endTimestamp: number,
  pageSize: number,
  fetchAllPages: boolean,
): Promise<{ value: number; timestamp: number }[]> {
  const resolvedChainId = chainId === 'all' ? 'mainnet' : chainId;
  const allResults: { value: number; timestamp: number }[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${METRICS_API_URL}/v2/chains/${resolvedChainId}/metrics/${metric}`);
    url.searchParams.set('timeInterval', timeInterval);
    url.searchParams.set('startTimestamp', String(startTimestamp));
    url.searchParams.set('endTimestamp', String(endTimestamp));
    url.searchParams.set('pageSize', String(pageSize)); // internal config, not user input
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`metrics-api ${res.status}: ${res.statusText}`);
    const data = await res.json();

    if (data.results && Array.isArray(data.results)) {
      allResults.push(...data.results);
    }

    pageToken = data.nextPageToken || undefined;
  } while (fetchAllPages && pageToken);

  return allResults;
}

async function getTimeSeriesData(
  metricType: string,
  chainId: string,
  timeRange: string,
  startTimestamp?: number,
  endTimestamp?: number,
  pageSize: number = 365,
  fetchAllPages: boolean = false,
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

    const results = await fetchMetricsApi(
      chainId,
      metricType,
      'day',
      finalStartTimestamp,
      finalEndTimestamp,
      pageSize,
      fetchAllPages,
    );

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((result) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0],
      }));
  } catch {
    // Per-metric failure; return empty array
    return [];
  }
}

async function getActiveAddressesData(
  chainId: string,
  timeRange: string,
  interval: 'day' | 'week' | 'month',
  startTimestampParam?: number,
  endTimestampParam?: number,
  pageSize: number = 365,
  fetchAllPages: boolean = false,
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

    const results = await fetchMetricsApi(
      chainId,
      'activeAddresses',
      interval,
      startTimestamp,
      endTimestamp,
      pageSize,
      fetchAllPages,
    );

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((result) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0],
      }));
  } catch {
    // Active addresses failure; return empty
    return [];
  }
}

// Metabase endpoint URL for reward distribution (returns both daily and cumulative)
// Only available for Avalanche C-Chain (43114)
const REWARDS_URL =
  'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/3e895234-4c31-40f7-a3ee-4656f6caf535/dashcard/6788/card/5464?parameters=%5B%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%22b87e50a4%22%2C%22target%22%3A%5B%22variable%22%2C%5B%22template-tag%22%2C%22address%22%5D%5D%7D%2C%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%2242440d5%22%2C%22target%22%3A%5B%22variable%22%2C%5B%22template-tag%22%2C%22Node_ID%22%5D%5D%7D%2C%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%22ccdf28e0%22%2C%22target%22%3A%5B%22dimension%22%2C%5B%22template-tag%22%2C%22Reward_Type%22%5D%2C%7B%22stage-number%22%3A0%7D%5D%7D%5D';

// Metabase endpoint URL for Primary Network emissions/burn/fees data
const PRIMARY_NETWORK_FEES_URL =
  'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/38ea69a5-e373-4258-9db6-8425fcba3a1a/dashcard/9955/card/13502?parameters=%5B%5D';

interface RewardsData {
  daily: TimeSeriesDataPoint[];
  cumulative: TimeSeriesDataPoint[];
}

interface PrimaryNetworkFeesData {
  netCumulativeEmissions: TimeSeriesDataPoint[];
  netEmissionsDaily: TimeSeriesDataPoint[];
  cumulativeBurn: TimeSeriesDataPoint[];
  totalBurnDaily: TimeSeriesDataPoint[];
  cChainFeesDaily: TimeSeriesDataPoint[];
  pChainFeesDaily: TimeSeriesDataPoint[];
  xChainFeesDaily: TimeSeriesDataPoint[];
  validatorFeesDaily: TimeSeriesDataPoint[];
  cumulativeCChainFees: TimeSeriesDataPoint[];
  cumulativePChainFees: TimeSeriesDataPoint[];
  cumulativeXChainFees: TimeSeriesDataPoint[];
  cumulativeValidatorFees: TimeSeriesDataPoint[];
}

async function fetchRewardsData(): Promise<RewardsData> {
  try {
    const response = await fetchWithTimeout(REWARDS_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      // Rewards fetch failed; return empty
      return { daily: [], cumulative: [] };
    }

    const data = await response.json();

    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      // Invalid Metabase format; return empty
      return { daily: [], cumulative: [] };
    }

    // Transform Metabase format to TimeSeriesDataPoint format
    // Metabase returns: [["2025-12-09T00:00:00Z", dailyValue, cumulativeValue], ...]
    const daily: TimeSeriesDataPoint[] = [];
    const cumulative: TimeSeriesDataPoint[] = [];

    data.data.rows.forEach((row: [string, number, number]) => {
      const dateStr = row[0];
      const dailyValue = row[1] || 0;
      const cumulativeValue = row[2] || 0;
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      const date = dateStr.split('T')[0];

      daily.push({ timestamp, value: dailyValue, date });
      cumulative.push({ timestamp, value: cumulativeValue, date });
    });

    // Sort by timestamp descending (most recent first)
    daily.sort((a, b) => b.timestamp - a.timestamp);
    cumulative.sort((a, b) => b.timestamp - a.timestamp);

    return { daily, cumulative };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      // Rewards data is best-effort
    }
    return { daily: [], cumulative: [] };
  }
}

// Authoritative AVAX supply endpoint for offset correction
const AVAX_SUPPLY_URL = 'https://data-api.avax.network/v1/avax/supply';

interface AvaxSupplyData {
  totalCBurned: string;
  totalPBurned: string;
  totalXBurned: string;
}

async function fetchAuthoritativeBurnTotals(): Promise<AvaxSupplyData | null> {
  try {
    const response = await fetchWithTimeout(AVAX_SUPPLY_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      // Burn totals fetch failed; return null
      return null;
    }

    const data = await response.json();
    if (!data.totalCBurned || !data.totalPBurned || !data.totalXBurned) {
      // Missing burn fields; return null
      return null;
    }

    if (
      isNaN(parseFloat(data.totalCBurned)) ||
      isNaN(parseFloat(data.totalPBurned)) ||
      isNaN(parseFloat(data.totalXBurned))
    ) {
      // Invalid burn values; return null
      return null;
    }

    return {
      totalCBurned: data.totalCBurned,
      totalPBurned: data.totalPBurned,
      totalXBurned: data.totalXBurned,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      // Authoritative burn totals fetch error
    }
    return null;
  }
}

async function fetchPrimaryNetworkFeesData(): Promise<PrimaryNetworkFeesData> {
  const emptyResult: PrimaryNetworkFeesData = {
    netCumulativeEmissions: [],
    netEmissionsDaily: [],
    cumulativeBurn: [],
    totalBurnDaily: [],
    cChainFeesDaily: [],
    pChainFeesDaily: [],
    xChainFeesDaily: [],
    validatorFeesDaily: [],
    cumulativeCChainFees: [],
    cumulativePChainFees: [],
    cumulativeXChainFees: [],
    cumulativeValidatorFees: [],
  };

  try {
    // Fetch Metabase data and authoritative burn totals in parallel
    const [metabaseResponse, authoritativeTotals] = await Promise.all([
      fetchWithTimeout(PRIMARY_NETWORK_FEES_URL, {
        headers: { Accept: 'application/json' },
      }),
      fetchAuthoritativeBurnTotals(),
    ]);

    if (!metabaseResponse.ok) {
      // Fees fetch failed; return empty
      return emptyResult;
    }

    const data = await metabaseResponse.json();

    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      // Invalid fees data format; return empty
      return emptyResult;
    }

    // Column mapping from the API:
    // idx[0] = date
    // idx[2] = cumulative burn
    // idx[3] = net cumulative emissions
    // idx[5] = total burn daily
    // idx[6] = net emissions daily
    // idx[7] = c chain tx fees daily
    // idx[8] = p chain tx fees daily
    // idx[9] = x chain tx fees daily
    // idx[10] = validator fees daily
    // idx[11] = cumulative c chain fees
    // idx[12] = cumulative p chain fees
    // idx[13] = cumulative x chain fees
    // idx[14] = cumulative validator fees daily

    const result: PrimaryNetworkFeesData = {
      netCumulativeEmissions: [],
      netEmissionsDaily: [],
      cumulativeBurn: [],
      totalBurnDaily: [],
      cChainFeesDaily: [],
      pChainFeesDaily: [],
      xChainFeesDaily: [],
      validatorFeesDaily: [],
      cumulativeCChainFees: [],
      cumulativePChainFees: [],
      cumulativeXChainFees: [],
      cumulativeValidatorFees: [],
    };

    data.data.rows.forEach((row: any[]) => {
      const dateStr = row[0];
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      const date = dateStr.split('T')[0];

      result.cumulativeBurn.push({ timestamp, value: row[2] || 0, date });
      result.netCumulativeEmissions.push({ timestamp, value: row[3] || 0, date });
      result.totalBurnDaily.push({ timestamp, value: row[5] || 0, date });
      result.netEmissionsDaily.push({ timestamp, value: row[6] || 0, date });
      result.cChainFeesDaily.push({ timestamp, value: row[7] || 0, date });
      result.pChainFeesDaily.push({ timestamp, value: row[8] || 0, date });
      result.xChainFeesDaily.push({ timestamp, value: row[9] || 0, date });
      result.validatorFeesDaily.push({ timestamp, value: row[10] || 0, date });
      result.cumulativeCChainFees.push({ timestamp, value: row[11] || 0, date });
      result.cumulativePChainFees.push({ timestamp, value: row[12] || 0, date });
      result.cumulativeXChainFees.push({ timestamp, value: row[13] || 0, date });
      result.cumulativeValidatorFees.push({ timestamp, value: row[14] || 0, date });
    });

    // Sort all arrays by timestamp descending (most recent first)
    Object.keys(result).forEach((key) => {
      (result as any)[key].sort((a: TimeSeriesDataPoint, b: TimeSeriesDataPoint) => b.timestamp - a.timestamp);
    });

    // Apply offset correction to align cumulative values with authoritative source
    const hasCumulativeData =
      result.cumulativeCChainFees.length > 0 &&
      result.cumulativePChainFees.length > 0 &&
      result.cumulativeXChainFees.length > 0 &&
      result.cumulativeValidatorFees.length > 0 &&
      result.cumulativeBurn.length > 0 &&
      result.netCumulativeEmissions.length > 0;

    if (authoritativeTotals && hasCumulativeData) {
      const authCBurned = parseFloat(authoritativeTotals.totalCBurned);
      const authPBurned = parseFloat(authoritativeTotals.totalPBurned);
      const authXBurned = parseFloat(authoritativeTotals.totalXBurned);
      const authTotalBurn = authCBurned + authPBurned + authXBurned;

      // Latest Metabase values (first element after descending sort)
      const latestCChain = result.cumulativeCChainFees[0].value as number;
      const latestPChain = result.cumulativePChainFees[0].value as number;
      const latestXChain = result.cumulativeXChainFees[0].value as number;
      const latestValidatorFees = result.cumulativeValidatorFees[0].value as number;
      const latestBurn = result.cumulativeBurn[0].value as number;

      const offsetC = authCBurned - latestCChain;
      const offsetP = authPBurned - latestPChain;
      const offsetX = authXBurned - latestXChain;
      // Cumulative burn in Metabase includes validator fees, so the authoritative
      // total burn should also include the Metabase validator fees for a correct offset
      const offsetBurn = authTotalBurn + latestValidatorFees - latestBurn;

      // Only apply if at least one offset is positive (Metabase is missing data)
      if (offsetC < 0 || offsetP < 0 || offsetX < 0) {
        // Negative offset detected (Metabase > Authoritative) - skip correction
      }

      if (offsetC > 0 || offsetP > 0 || offsetX > 0) {
        // Applying burn offset correction from authoritative totals

        if (offsetC > 0) {
          result.cumulativeCChainFees = result.cumulativeCChainFees.map((point) => ({
            ...point,
            value: (point.value as number) + offsetC,
          }));
        }
        if (offsetP > 0) {
          result.cumulativePChainFees = result.cumulativePChainFees.map((point) => ({
            ...point,
            value: (point.value as number) + offsetP,
          }));
        }
        if (offsetX > 0) {
          result.cumulativeXChainFees = result.cumulativeXChainFees.map((point) => ({
            ...point,
            value: (point.value as number) + offsetX,
          }));
        }
        if (offsetBurn > 0) {
          result.cumulativeBurn = result.cumulativeBurn.map((point) => ({
            ...point,
            value: (point.value as number) + offsetBurn,
          }));
          // Also adjust net cumulative emissions (emissions = rewards - burn)
          // Since burn increased, net emissions decrease by the same offset
          result.netCumulativeEmissions = result.netCumulativeEmissions.map((point) => ({
            ...point,
            value: (point.value as number) - offsetBurn,
          }));
        }
      }
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      // Primary network fees fetch error
    }
    return emptyResult;
  }
}

async function getICMData(
  chainId: string,
  timeRange: string,
  startTimestamp?: number,
  endTimestamp?: number,
): Promise<ICMDataPoint[]> {
  try {
    let days: number;
    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      const startDate = new Date(startTimestamp * 1000);
      const endDate = new Date(endTimestamp * 1000);
      days = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      const getDaysFromTimeRange = (range: string): number => {
        switch (range) {
          case '7d':
            return 7;
          case '30d':
            return 30;
          case '90d':
            return 90;
          case 'all':
            return 730;
          default:
            return 30;
        }
      };
      days = getDaysFromTimeRange(timeRange);
    }

    let result = await getChainICMData(chainId, days);

    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      result = result.filter((item) => item.timestamp >= startTimestamp && item.timestamp <= endTimestamp);
    }

    return result;
  } catch {
    // ICM data failure; return empty
    return [];
  }
}

const ALL_METRICS = [
  'activeAddresses',
  'activeSenders',
  'cumulativeAddresses',
  'cumulativeDeployers',
  'txCount',
  'cumulativeTxCount',
  'cumulativeContracts',
  'contracts',
  'deployers',
  'gasUsed',
  'avgGps',
  'maxGps',
  'avgTps',
  'maxTps',
  'avgGasPrice',
  'maxGasPrice',
  'feesPaid',
  'icmMessages',
  'dailyRewards',
  'cumulativeRewards',
  // Primary Network specific metrics
  'netCumulativeEmissions',
  'netEmissionsDaily',
  'cumulativeBurn',
  'totalBurnDaily',
  'cChainFeesDaily',
  'pChainFeesDaily',
  'xChainFeesDaily',
  'validatorFeesDaily',
  'cumulativeCChainFees',
  'cumulativePChainFees',
  'cumulativeXChainFees',
  'cumulativeValidatorFees',
] as const;

// Metrics that are only available for the Primary Network
const _PRIMARY_NETWORK_ONLY_METRICS = [
  'dailyRewards',
  'cumulativeRewards',
  'netCumulativeEmissions',
  'netEmissionsDaily',
  'cumulativeBurn',
  'totalBurnDaily',
  'cChainFeesDaily',
  'pChainFeesDaily',
  'xChainFeesDaily',
  'validatorFeesDaily',
  'cumulativeCChainFees',
  'cumulativePChainFees',
  'cumulativeXChainFees',
  'cumulativeValidatorFees',
] as const;

type MetricKey = (typeof ALL_METRICS)[number];

async function fetchFreshDataInternal(
  chainId: string,
  timeRange: string,
  requestedMetrics: MetricKey[],
  startTimestamp?: number,
  endTimestamp?: number,
  isSpecificMetricsMode: boolean = false,
): Promise<ChainMetrics | null> {
  try {
    const config =
      STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;

    const fetchPromises: { [key: string]: Promise<TimeSeriesDataPoint[] | ICMDataPoint[]> } = {};

    // activeAddresses with variants
    if (requestedMetrics.includes('activeAddresses')) {
      fetchPromises['dailyActiveAddresses'] = getActiveAddressesData(
        chainId,
        timeRange,
        'day',
        startTimestamp,
        endTimestamp,
        pageSize,
        fetchAllPages,
      );
      if (!isSpecificMetricsMode) {
        fetchPromises['weeklyActiveAddresses'] = getActiveAddressesData(
          chainId,
          timeRange,
          'week',
          startTimestamp,
          endTimestamp,
          pageSize,
          fetchAllPages,
        );
        fetchPromises['monthlyActiveAddresses'] = getActiveAddressesData(
          chainId,
          timeRange,
          'month',
          startTimestamp,
          endTimestamp,
          pageSize,
          fetchAllPages,
        );
      }
    }

    // Standard metrics
    const standardMetrics: MetricKey[] = [
      'activeSenders',
      'cumulativeAddresses',
      'cumulativeDeployers',
      'txCount',
      'cumulativeTxCount',
      'cumulativeContracts',
      'contracts',
      'deployers',
      'gasUsed',
      'avgGps',
      'maxGps',
      'avgTps',
      'maxTps',
      'avgGasPrice',
      'maxGasPrice',
      'feesPaid',
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
          fetchAllPages,
        );
      }
    }

    // ICM messages
    if (requestedMetrics.includes('icmMessages')) {
      fetchPromises['icmMessages'] = getICMData(chainId, timeRange, startTimestamp, endTimestamp);
    }

    // Primary Network data (available for chainId "43114" or "primary")
    const isPrimaryNetwork = chainId === '43114' || chainId === 'primary';
    let rewardsData: RewardsData | null = null;
    let primaryNetworkFeesData: PrimaryNetworkFeesData | null = null;

    if (
      isPrimaryNetwork &&
      (requestedMetrics.includes('dailyRewards') || requestedMetrics.includes('cumulativeRewards'))
    ) {
      rewardsData = await fetchRewardsData();
    }

    // Check if any Primary Network fees metrics are requested
    const primaryNetworkFeesMetrics: MetricKey[] = [
      'netCumulativeEmissions',
      'netEmissionsDaily',
      'cumulativeBurn',
      'totalBurnDaily',
      'cChainFeesDaily',
      'pChainFeesDaily',
      'xChainFeesDaily',
      'validatorFeesDaily',
      'cumulativeCChainFees',
      'cumulativePChainFees',
      'cumulativeXChainFees',
      'cumulativeValidatorFees',
    ];
    const needsPrimaryNetworkFees =
      isPrimaryNetwork && requestedMetrics.some((m) => primaryNetworkFeesMetrics.includes(m));

    if (needsPrimaryNetworkFees) {
      primaryNetworkFeesData = await fetchPrimaryNetworkFeesData();
    }

    // Fetch all in parallel
    const fetchKeys = Object.keys(fetchPromises);
    const fetchResults = await Promise.all(Object.values(fetchPromises));

    const results: { [key: string]: TimeSeriesDataPoint[] | ICMDataPoint[] } = {};
    fetchKeys.forEach((key, index) => {
      results[key] = fetchResults[index];
    });

    // Build metrics object
    const metrics: Partial<ChainMetrics> & { activeAddresses?: any } = {
      last_updated: Date.now(),
    };

    if (requestedMetrics.includes('activeAddresses')) {
      if (isSpecificMetricsMode) {
        metrics.activeAddresses = createTimeSeriesMetric(results['dailyActiveAddresses'] as TimeSeriesDataPoint[]);
      } else {
        metrics.activeAddresses = {
          daily: createTimeSeriesMetric(results['dailyActiveAddresses'] as TimeSeriesDataPoint[]),
          weekly: createTimeSeriesMetric(results['weeklyActiveAddresses'] as TimeSeriesDataPoint[]),
          monthly: createTimeSeriesMetric(results['monthlyActiveAddresses'] as TimeSeriesDataPoint[]),
        };
      }
    }

    // Map standard metrics
    const metricMappings: { key: MetricKey; resultKey: string }[] = [
      { key: 'activeSenders', resultKey: 'activeSenders' },
      { key: 'cumulativeAddresses', resultKey: 'cumulativeAddresses' },
      { key: 'cumulativeDeployers', resultKey: 'cumulativeDeployers' },
      { key: 'txCount', resultKey: 'txCount' },
      { key: 'cumulativeTxCount', resultKey: 'cumulativeTxCount' },
      { key: 'cumulativeContracts', resultKey: 'cumulativeContracts' },
      { key: 'contracts', resultKey: 'contracts' },
      { key: 'deployers', resultKey: 'deployers' },
      { key: 'gasUsed', resultKey: 'gasUsed' },
      { key: 'avgGps', resultKey: 'avgGps' },
      { key: 'maxGps', resultKey: 'maxGps' },
      { key: 'avgTps', resultKey: 'avgTps' },
      { key: 'maxTps', resultKey: 'maxTps' },
      { key: 'avgGasPrice', resultKey: 'avgGasPrice' },
      { key: 'maxGasPrice', resultKey: 'maxGasPrice' },
      { key: 'feesPaid', resultKey: 'feesPaid' },
    ];

    for (const mapping of metricMappings) {
      if (requestedMetrics.includes(mapping.key) && results[mapping.resultKey]) {
        (metrics as any)[mapping.key] = createTimeSeriesMetric(results[mapping.resultKey] as TimeSeriesDataPoint[]);
      }
    }

    if (requestedMetrics.includes('icmMessages') && results['icmMessages']) {
      metrics.icmMessages = createICMMetric(results['icmMessages'] as ICMDataPoint[]);
    }

    // Add rewards data (only for Primary Network)
    if (rewardsData) {
      if (requestedMetrics.includes('dailyRewards') && rewardsData.daily.length > 0) {
        metrics.dailyRewards = createTimeSeriesMetric(rewardsData.daily);
      }
      if (requestedMetrics.includes('cumulativeRewards') && rewardsData.cumulative.length > 0) {
        metrics.cumulativeRewards = createTimeSeriesMetric(rewardsData.cumulative);
      }
    }

    // Add Primary Network fees data
    if (primaryNetworkFeesData) {
      if (
        requestedMetrics.includes('netCumulativeEmissions') &&
        primaryNetworkFeesData.netCumulativeEmissions.length > 0
      ) {
        metrics.netCumulativeEmissions = createTimeSeriesMetric(primaryNetworkFeesData.netCumulativeEmissions);
      }
      if (requestedMetrics.includes('netEmissionsDaily') && primaryNetworkFeesData.netEmissionsDaily.length > 0) {
        metrics.netEmissionsDaily = createTimeSeriesMetric(primaryNetworkFeesData.netEmissionsDaily);
      }
      if (requestedMetrics.includes('cumulativeBurn') && primaryNetworkFeesData.cumulativeBurn.length > 0) {
        metrics.cumulativeBurn = createTimeSeriesMetric(primaryNetworkFeesData.cumulativeBurn);
      }
      if (requestedMetrics.includes('totalBurnDaily') && primaryNetworkFeesData.totalBurnDaily.length > 0) {
        metrics.totalBurnDaily = createTimeSeriesMetric(primaryNetworkFeesData.totalBurnDaily);
      }
      if (requestedMetrics.includes('cChainFeesDaily') && primaryNetworkFeesData.cChainFeesDaily.length > 0) {
        metrics.cChainFeesDaily = createTimeSeriesMetric(primaryNetworkFeesData.cChainFeesDaily);
      }
      if (requestedMetrics.includes('pChainFeesDaily') && primaryNetworkFeesData.pChainFeesDaily.length > 0) {
        metrics.pChainFeesDaily = createTimeSeriesMetric(primaryNetworkFeesData.pChainFeesDaily);
      }
      if (requestedMetrics.includes('xChainFeesDaily') && primaryNetworkFeesData.xChainFeesDaily.length > 0) {
        metrics.xChainFeesDaily = createTimeSeriesMetric(primaryNetworkFeesData.xChainFeesDaily);
      }
      if (requestedMetrics.includes('validatorFeesDaily') && primaryNetworkFeesData.validatorFeesDaily.length > 0) {
        metrics.validatorFeesDaily = createTimeSeriesMetric(primaryNetworkFeesData.validatorFeesDaily);
      }
      if (requestedMetrics.includes('cumulativeCChainFees') && primaryNetworkFeesData.cumulativeCChainFees.length > 0) {
        metrics.cumulativeCChainFees = createTimeSeriesMetric(primaryNetworkFeesData.cumulativeCChainFees);
      }
      if (requestedMetrics.includes('cumulativePChainFees') && primaryNetworkFeesData.cumulativePChainFees.length > 0) {
        metrics.cumulativePChainFees = createTimeSeriesMetric(primaryNetworkFeesData.cumulativePChainFees);
      }
      if (requestedMetrics.includes('cumulativeXChainFees') && primaryNetworkFeesData.cumulativeXChainFees.length > 0) {
        metrics.cumulativeXChainFees = createTimeSeriesMetric(primaryNetworkFeesData.cumulativeXChainFees);
      }
      if (
        requestedMetrics.includes('cumulativeValidatorFees') &&
        primaryNetworkFeesData.cumulativeValidatorFees.length > 0
      ) {
        metrics.cumulativeValidatorFees = createTimeSeriesMetric(primaryNetworkFeesData.cumulativeValidatorFees);
      }
    }

    return metrics as ChainMetrics;
  } catch {
    // Fresh data fetch failed; return null
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
  status = 200,
) {
  const headers: Record<string, string> = {
    'Cache-Control': CACHE_CONTROL_HEADER,
    'X-Data-Source': meta.source,
  };
  if (meta.chainId) headers['X-Chain-Id'] = meta.chainId;
  if (meta.timeRange) headers['X-Time-Range'] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  if (meta.metrics) headers['X-Metrics'] = meta.metrics;
  return NextResponse.json(data, { status, headers });
}

export const GET = withApi(async (req, { params }) => {
  const timeRange = req.nextUrl.searchParams.get('timeRange') || '30d';
  const startTimestampParam = req.nextUrl.searchParams.get('startTimestamp');
  const endTimestampParam = req.nextUrl.searchParams.get('endTimestamp');
  const metricsParam = req.nextUrl.searchParams.get('metrics');
  const chainId = params.chainId;

  if (!chainId) {
    return createResponse({ error: 'Chain ID is required' }, { source: 'error' }, 400);
  }

  const startTimestamp = startTimestampParam ? parseInt(startTimestampParam, 10) : undefined;
  const endTimestamp = endTimestampParam ? parseInt(endTimestampParam, 10) : undefined;

  if (startTimestamp !== undefined && isNaN(startTimestamp)) {
    return createResponse({ error: 'Invalid startTimestamp parameter' }, { source: 'error' }, 400);
  }
  if (endTimestamp !== undefined && isNaN(endTimestamp)) {
    return createResponse({ error: 'Invalid endTimestamp parameter' }, { source: 'error' }, 400);
  }
  if (startTimestamp !== undefined && endTimestamp !== undefined && startTimestamp > endTimestamp) {
    return createResponse(
      { error: 'startTimestamp must be less than or equal to endTimestamp' },
      { source: 'error' },
      400,
    );
  }

  const requestedMetrics: MetricKey[] = metricsParam
    ? metricsParam.split(',').filter((m): m is MetricKey => ALL_METRICS.includes(m as MetricKey))
    : [...ALL_METRICS];

  if (metricsParam && requestedMetrics.length === 0) {
    return createResponse(
      { error: 'Invalid metrics parameter. Valid metrics: ' + ALL_METRICS.join(', ') },
      { source: 'error' },
      400,
    );
  }

  const isSpecificMetricsMode = metricsParam !== null;
  const metricsKey = requestedMetrics.sort().join(',');
  const cacheKey =
    startTimestamp !== undefined && endTimestamp !== undefined
      ? `${chainId}-${startTimestamp}-${endTimestamp}-${metricsKey}`
      : `${chainId}-${timeRange}-${metricsKey}`;

  if (req.nextUrl.searchParams.get('clearCache') === 'true') {
    cachedData.clear();
    revalidatingKeys.clear();
  }

  const cached = cachedData.get(cacheKey);
  const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
  const isCacheValid = cacheAge < STATS_CONFIG.CACHE.LONG_DURATION;
  const isCacheStale = cached && !isCacheValid;

  if (isCacheStale && !revalidatingKeys.has(cacheKey)) {
    revalidatingKeys.add(cacheKey);

    (async () => {
      try {
        const freshData = await fetchFreshDataInternal(
          chainId,
          timeRange,
          requestedMetrics,
          startTimestamp,
          endTimestamp,
          isSpecificMetricsMode,
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

    return createResponse(cached.data, {
      source: 'stale-while-revalidate',
      chainId,
      timeRange,
      cacheAge,
      metrics: metricsKey,
    });
  }

  if (isCacheValid && cached) {
    if (
      requestedMetrics.includes('icmMessages') &&
      startTimestamp === undefined &&
      endTimestamp === undefined &&
      cached.icmTimeRange !== timeRange
    ) {
      try {
        const newICMData = await getICMData(chainId, timeRange);
        cached.data.icmMessages = createICMMetric(newICMData);
        cached.icmTimeRange = timeRange;
        cachedData.set(cacheKey, cached);
      } catch {
        // ICM refresh is best-effort
      }
    }

    return createResponse(cached.data, {
      source: 'cache',
      chainId,
      timeRange,
      cacheAge,
      metrics: metricsKey,
    });
  }

  const pendingKey = cacheKey;
  let pendingPromise = pendingRequests.get(pendingKey);

  if (!pendingPromise) {
    pendingPromise = fetchFreshDataInternal(
      chainId,
      timeRange,
      requestedMetrics,
      startTimestamp,
      endTimestamp,
      isSpecificMetricsMode,
    );
    pendingRequests.set(pendingKey, pendingPromise);
    pendingPromise.finally(() => pendingRequests.delete(pendingKey));
  }

  const startTime = Date.now();
  const freshData = await pendingPromise;

  if (!freshData) {
    const fallbackCacheKey = `${chainId}-30d-${metricsKey}`;
    const fallbackCached = cachedData.get(fallbackCacheKey);
    if (fallbackCached) {
      return createResponse(
        fallbackCached.data,
        {
          source: 'fallback-cache',
          chainId,
          timeRange: '30d',
          cacheAge: Date.now() - fallbackCached.timestamp,
          metrics: metricsKey,
        },
        206,
      );
    }
    return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error', chainId }, 500);
  }

  cachedData.set(cacheKey, {
    data: freshData,
    timestamp: Date.now(),
    icmTimeRange: timeRange,
  });

  const fetchTime = Date.now() - startTime;
  return createResponse(freshData, {
    source: 'fresh',
    chainId,
    timeRange,
    fetchTime,
    metrics: metricsKey,
  });
});
