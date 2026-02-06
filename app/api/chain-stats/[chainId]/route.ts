import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { TimeSeriesDataPoint, TimeSeriesMetric, ICMDataPoint, ICMMetric, STATS_CONFIG, getTimestampsFromTimeRange, createTimeSeriesMetric, createICMMetric } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";

// Filter to only mainnet chains for ICM aggregation
const mainnetChains = l1ChainsData.filter(c => (c as { isTestnet?: boolean }).isTestnet !== true);

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const getRlToken = () => process.env.METRICS_BYPASS_TOKEN || '';

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
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
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
    
    let allResults: any[] = [];
    const rlToken = getRlToken();
    
    const params: any = {
      metric: metricType as any,
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
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn(`[getTimeSeriesData] Failed for ${metricType} on chain ${chainId}:`, error);
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
    
    let allResults: any[] = [];
    const rlToken = getRlToken();
    
    const params: any = {
      metric: 'activeAddresses',
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
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn(`[getActiveAddressesData] Failed for chain ${chainId} (${interval}):`, error);
    return [];
  }
}

// Metabase endpoint URL for reward distribution (returns both daily and cumulative)
// Only available for Avalanche C-Chain (43114)
const REWARDS_URL = 'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/3e895234-4c31-40f7-a3ee-4656f6caf535/dashcard/6788/card/5464?parameters=%5B%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%22b87e50a4%22%2C%22target%22%3A%5B%22variable%22%2C%5B%22template-tag%22%2C%22address%22%5D%5D%7D%2C%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%2242440d5%22%2C%22target%22%3A%5B%22variable%22%2C%5B%22template-tag%22%2C%22Node_ID%22%5D%5D%7D%2C%7B%22type%22%3A%22string%2F%3D%22%2C%22value%22%3Anull%2C%22id%22%3A%22ccdf28e0%22%2C%22target%22%3A%5B%22dimension%22%2C%5B%22template-tag%22%2C%22Reward_Type%22%5D%2C%7B%22stage-number%22%3A0%7D%5D%7D%5D';

// Metabase endpoint URL for Primary Network emissions/burn/fees data
const PRIMARY_NETWORK_FEES_URL = 'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/38ea69a5-e373-4258-9db6-8425fcba3a1a/dashcard/9955/card/13502?parameters=%5B%5D';

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
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`[fetchRewardsData] Failed to fetch: ${response.status}`);
      return { daily: [], cumulative: [] };
    }

    const data = await response.json();
    
    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      console.warn('[fetchRewardsData] Invalid data format');
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
      console.warn('[fetchRewardsData] Error:', error);
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
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`[fetchAuthoritativeBurnTotals] Failed to fetch: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.totalCBurned || !data.totalPBurned || !data.totalXBurned) {
      console.warn('[fetchAuthoritativeBurnTotals] Missing burn fields in response');
      return null;
    }

    if (isNaN(parseFloat(data.totalCBurned)) ||
        isNaN(parseFloat(data.totalPBurned)) ||
        isNaN(parseFloat(data.totalXBurned))) {
      console.warn('[fetchAuthoritativeBurnTotals] Invalid numeric values in response');
      return null;
    }

    return {
      totalCBurned: data.totalCBurned,
      totalPBurned: data.totalPBurned,
      totalXBurned: data.totalXBurned,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn('[fetchAuthoritativeBurnTotals] Error:', error);
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
        headers: { 'Accept': 'application/json' }
      }),
      fetchAuthoritativeBurnTotals(),
    ]);

    if (!metabaseResponse.ok) {
      console.warn(`[fetchPrimaryNetworkFeesData] Failed to fetch: ${metabaseResponse.status}`);
      return emptyResult;
    }

    const data = await metabaseResponse.json();

    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      console.warn('[fetchPrimaryNetworkFeesData] Invalid data format');
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
    const hasCumulativeData = result.cumulativeCChainFees.length > 0 &&
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
      const offsetBurn = (authTotalBurn + latestValidatorFees) - latestBurn;

      // Only apply if at least one offset is positive (Metabase is missing data)
      if (offsetC < 0 || offsetP < 0 || offsetX < 0) {
        console.warn(
          `[fetchPrimaryNetworkFeesData] Negative offset detected (Metabase > Authoritative): ` +
          `C: ${offsetC.toFixed(2)}, P: ${offsetP.toFixed(2)}, X: ${offsetX.toFixed(2)}`
        );
      }

      if (offsetC > 0 || offsetP > 0 || offsetX > 0) {
        console.warn(
          `[fetchPrimaryNetworkFeesData] Applying burn offset correction: ` +
          `C-Chain: +${offsetC.toFixed(2)}, P-Chain: +${offsetP.toFixed(2)}, ` +
          `X-Chain: +${offsetX.toFixed(2)}, Total Burn: +${offsetBurn.toFixed(2)}`
        );

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
      console.warn('[fetchPrimaryNetworkFeesData] Error:', error);
    }
    return emptyResult;
  }
}

async function getICMData(
  chainId: string,
  timeRange: string,
  startTimestamp?: number,
  endTimestamp?: number
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
          case '7d': return 7;
          case '30d': return 30;
          case '90d': return 90;
          case 'all': return 365;
          default: return 30;
        }
      };
      days = getDaysFromTimeRange(timeRange);
    }

    // For "all" chains, aggregate data from all mainnet chains
    if (chainId === "all") {
      return await aggregateAllChainsICMData(days, startTimestamp, endTimestamp);
    }

    const response = await fetchWithTimeout(
      `https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${days}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    let filteredData = data
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((item: any) => ({
        timestamp: item.timestamp,
        date: item.date,
        messageCount: item.messageCount || 0,
        incomingCount: item.incomingCount || 0,
        outgoingCount: item.outgoingCount || 0,
      }));

    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      filteredData = filteredData.filter((item: ICMDataPoint) =>
        item.timestamp >= startTimestamp && item.timestamp <= endTimestamp
      );
    }

    return filteredData;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn(`[getICMData] Failed for chain ${chainId}:`, error);
    }
    return [];
  }
}

// Helper function to aggregate ICM data from all mainnet chains
async function aggregateAllChainsICMData(
  days: number,
  startTimestamp?: number,
  endTimestamp?: number
): Promise<ICMDataPoint[]> {
  const aggregatedByDate = new Map<string, ICMDataPoint>();

  // Process chains in batches to avoid overwhelming the API
  const BATCH_SIZE = 20;

  for (let i = 0; i < mainnetChains.length; i += BATCH_SIZE) {
    const batch = mainnetChains.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (chain) => {
        try {
          const response = await fetchWithTimeout(
            `https://idx6.solokhin.com/api/${chain.chainId}/metrics/dailyMessageVolume?days=${days}`,
            { headers: { 'Accept': 'application/json' } }
          );

          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.forEach((item: any) => {
                const dateKey = item.date;
                const existing = aggregatedByDate.get(dateKey);

                if (existing) {
                  existing.messageCount += item.messageCount || 0;
                  existing.incomingCount += item.incomingCount || 0;
                  existing.outgoingCount += item.outgoingCount || 0;
                } else {
                  aggregatedByDate.set(dateKey, {
                    timestamp: item.timestamp,
                    date: item.date,
                    messageCount: item.messageCount || 0,
                    incomingCount: item.incomingCount || 0,
                    outgoingCount: item.outgoingCount || 0,
                  });
                }
              });
            }
          }
        } catch {
          // skip chains that fail or timeout
        }
      })
    );
  }

  let result = Array.from(aggregatedByDate.values())
    .sort((a, b) => b.timestamp - a.timestamp);

  if (startTimestamp !== undefined && endTimestamp !== undefined) {
    result = result.filter((item) =>
      item.timestamp >= startTimestamp && item.timestamp <= endTimestamp
    );
  }

  return result;
}

const ALL_METRICS = [
  'activeAddresses', 'activeSenders', 'cumulativeAddresses', 'cumulativeDeployers',
  'txCount', 'cumulativeTxCount', 'cumulativeContracts', 'contracts', 'deployers',
  'gasUsed', 'avgGps', 'maxGps', 'avgTps', 'maxTps', 'avgGasPrice', 'maxGasPrice',
  'feesPaid', 'icmMessages', 'dailyRewards', 'cumulativeRewards',
  // Primary Network specific metrics
  'netCumulativeEmissions', 'netEmissionsDaily', 'cumulativeBurn', 'totalBurnDaily',
  'cChainFeesDaily', 'pChainFeesDaily', 'xChainFeesDaily', 'validatorFeesDaily',
  'cumulativeCChainFees', 'cumulativePChainFees', 'cumulativeXChainFees', 'cumulativeValidatorFees',
] as const;

// Metrics that are only available for the Primary Network
const PRIMARY_NETWORK_ONLY_METRICS = [
  'dailyRewards', 'cumulativeRewards',
  'netCumulativeEmissions', 'netEmissionsDaily', 'cumulativeBurn', 'totalBurnDaily',
  'cChainFeesDaily', 'pChainFeesDaily', 'xChainFeesDaily', 'validatorFeesDaily',
  'cumulativeCChainFees', 'cumulativePChainFees', 'cumulativeXChainFees', 'cumulativeValidatorFees',
] as const;

type MetricKey = typeof ALL_METRICS[number];

async function fetchFreshDataInternal(
  chainId: string,
  timeRange: string,
  requestedMetrics: MetricKey[],
  startTimestamp?: number,
  endTimestamp?: number,
  isSpecificMetricsMode: boolean = false
): Promise<ChainMetrics | null> {
  try {
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;
    
    const fetchPromises: { [key: string]: Promise<TimeSeriesDataPoint[] | ICMDataPoint[]> } = {};
    
    // activeAddresses with variants
    if (requestedMetrics.includes('activeAddresses')) {
      fetchPromises['dailyActiveAddresses'] = getActiveAddressesData(chainId, timeRange, 'day', startTimestamp, endTimestamp, pageSize, fetchAllPages);
      if (!isSpecificMetricsMode) {
        fetchPromises['weeklyActiveAddresses'] = getActiveAddressesData(chainId, timeRange, 'week', startTimestamp, endTimestamp, pageSize, fetchAllPages);
        fetchPromises['monthlyActiveAddresses'] = getActiveAddressesData(chainId, timeRange, 'month', startTimestamp, endTimestamp, pageSize, fetchAllPages);
      }
    }
    
    // Standard metrics
    const standardMetrics: MetricKey[] = [
      'activeSenders', 'cumulativeAddresses', 'cumulativeDeployers', 'txCount',
      'cumulativeTxCount', 'cumulativeContracts', 'contracts', 'deployers',
      'gasUsed', 'avgGps', 'maxGps', 'avgTps', 'maxTps', 'avgGasPrice',
      'maxGasPrice', 'feesPaid'
    ];
    
    for (const metric of standardMetrics) {
      if (requestedMetrics.includes(metric)) {
        fetchPromises[metric] = getTimeSeriesData(metric, chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages);
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
    
    if (isPrimaryNetwork && (requestedMetrics.includes('dailyRewards') || requestedMetrics.includes('cumulativeRewards'))) {
      rewardsData = await fetchRewardsData();
    }
    
    // Check if any Primary Network fees metrics are requested
    const primaryNetworkFeesMetrics: MetricKey[] = [
      'netCumulativeEmissions', 'netEmissionsDaily', 'cumulativeBurn', 'totalBurnDaily',
      'cChainFeesDaily', 'pChainFeesDaily', 'xChainFeesDaily', 'validatorFeesDaily',
      'cumulativeCChainFees', 'cumulativePChainFees', 'cumulativeXChainFees', 'cumulativeValidatorFees',
    ];
    const needsPrimaryNetworkFees = isPrimaryNetwork && 
      requestedMetrics.some(m => primaryNetworkFeesMetrics.includes(m));
    
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
      last_updated: Date.now()
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
      if (requestedMetrics.includes('netCumulativeEmissions') && primaryNetworkFeesData.netCumulativeEmissions.length > 0) {
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
      if (requestedMetrics.includes('cumulativeValidatorFees') && primaryNetworkFeesData.cumulativeValidatorFees.length > 0) {
        metrics.cumulativeValidatorFees = createTimeSeriesMetric(primaryNetworkFeesData.cumulativeValidatorFees);
      }
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
    'Cache-Control': CACHE_CONTROL_HEADER, 
    'X-Data-Source': meta.source 
  };
  if (meta.chainId) headers['X-Chain-Id'] = meta.chainId;
  if (meta.timeRange) headers['X-Time-Range'] = meta.timeRange;
  if (meta.cacheAge !== undefined) headers['X-Cache-Age'] = `${Math.round(meta.cacheAge / 1000)}s`;
  if (meta.fetchTime !== undefined) headers['X-Fetch-Time'] = `${meta.fetchTime}ms`;
  if (meta.metrics) headers['X-Metrics'] = meta.metrics;
  return NextResponse.json(data, { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const startTimestampParam = searchParams.get('startTimestamp');
    const endTimestampParam = searchParams.get('endTimestamp');
    const metricsParam = searchParams.get('metrics');
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;
    
    if (!chainId) {
      return createResponse({ error: 'Chain ID is required' }, { source: 'error' }, 400);
    }

    // Parse timestamps
    const startTimestamp = startTimestampParam ? parseInt(startTimestampParam, 10) : undefined;
    const endTimestamp = endTimestampParam ? parseInt(endTimestampParam, 10) : undefined;
    
    // Validate timestamps
    if (startTimestamp !== undefined && isNaN(startTimestamp)) {
      return createResponse({ error: 'Invalid startTimestamp parameter' }, { source: 'error' }, 400);
    }
    if (endTimestamp !== undefined && isNaN(endTimestamp)) {
      return createResponse({ error: 'Invalid endTimestamp parameter' }, { source: 'error' }, 400);
    }
    if (startTimestamp !== undefined && endTimestamp !== undefined && startTimestamp > endTimestamp) {
      return createResponse({ error: 'startTimestamp must be less than or equal to endTimestamp' }, { source: 'error' }, 400);
    }

    // Parse requested metrics
    const requestedMetrics: MetricKey[] = metricsParam
      ? metricsParam.split(',').filter((m): m is MetricKey => ALL_METRICS.includes(m as MetricKey))
      : [...ALL_METRICS];
    
    if (metricsParam && requestedMetrics.length === 0) {
      return createResponse(
        { error: 'Invalid metrics parameter. Valid metrics: ' + ALL_METRICS.join(', ') },
        { source: 'error' },
        400
      );
    }

    const isSpecificMetricsMode = metricsParam !== null;
    const metricsKey = requestedMetrics.sort().join(',');
    const cacheKey = startTimestamp !== undefined && endTimestamp !== undefined
      ? `${chainId}-${startTimestamp}-${endTimestamp}-${metricsKey}`
      : `${chainId}-${timeRange}-${metricsKey}`;
    
    if (searchParams.get('clearCache') === 'true') {
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
            chainId, timeRange, requestedMetrics, 
            startTimestamp, endTimestamp, isSpecificMetricsMode
          );
          if (freshData) {
            cachedData.set(cacheKey, { 
              data: freshData, 
              timestamp: Date.now(), 
              icmTimeRange: timeRange 
            });
          }
        } finally {
          revalidatingKeys.delete(cacheKey);
        }
      })();
      
      console.log(`[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: stale-while-revalidate`);
      return createResponse(cached.data, { 
        source: 'stale-while-revalidate', 
        chainId,
        timeRange, 
        cacheAge,
        metrics: metricsKey
      });
    }
    
    // Return valid cache
    if (isCacheValid && cached) {
      // Refresh ICM if timeRange changed
      if (requestedMetrics.includes('icmMessages') && 
          startTimestamp === undefined && 
          endTimestamp === undefined && 
          cached.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(chainId, timeRange);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = timeRange;
          cachedData.set(cacheKey, cached);
        } catch (error) {
          console.warn('[GET] Failed to refresh ICM data:', error);
        }
      }
      
      console.log(`[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: cache`);
      return createResponse(cached.data, { 
        source: 'cache', 
        chainId,
        timeRange, 
        cacheAge,
        metrics: metricsKey
      });
    }
    
    // Deduplicate pending requests
    const pendingKey = cacheKey;
    let pendingPromise = pendingRequests.get(pendingKey);
    
    if (!pendingPromise) {
      pendingPromise = fetchFreshDataInternal(
        chainId, timeRange, requestedMetrics, 
        startTimestamp, endTimestamp, isSpecificMetricsMode
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
        return createResponse(fallbackCached.data, { 
          source: 'fallback-cache', 
          chainId,
          timeRange: '30d',
          cacheAge: Date.now() - fallbackCached.timestamp,
          metrics: metricsKey
        }, 206);
      }
      console.log(`[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: error (no data)`);
      return createResponse({ error: 'Failed to fetch chain metrics' }, { source: 'error', chainId }, 500);
    }
    
    // Cache fresh data
    cachedData.set(cacheKey, { 
      data: freshData, 
      timestamp: Date.now(), 
      icmTimeRange: timeRange 
    });
    
    const fetchTime = Date.now() - startTime;
    console.log(`[GET /api/chain-stats/${chainId}] TimeRange: ${timeRange}, Source: fresh, fetchTime: ${fetchTime}ms`);

    return createResponse(freshData, { 
      source: 'fresh', 
      chainId,
      timeRange, 
      fetchTime,
      metrics: metricsKey
    });
  } catch (error) {
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;
    console.error(`[GET /api/chain-stats/${chainId}] Unhandled error:`, error);
    return createResponse(
      { error: 'Failed to fetch chain metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { source: 'error', chainId },
      500
    );
  }
}
