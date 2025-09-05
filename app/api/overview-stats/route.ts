import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";
import { TimeSeriesDataPoint, TimeSeriesMetric, ICMDataPoint, ICMMetric, STATS_CONFIG, createTimeSeriesMetric,
  getTimestampsFromTimeRange, createTimeSeriesMetricWithPeriodSum, createICMMetricWithPeriodSum } from "@/types/stats";

const avalanche = new Avalanche({
  network: "mainnet",
});

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: TimeSeriesMetric;
  activeAddresses: TimeSeriesMetric;
  icmMessages: ICMMetric;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: TimeSeriesMetric;
    totalActiveAddresses: TimeSeriesMetric;
    totalICMMessages: ICMMetric;
    totalValidators: number;
    activeChains: number;
  };
  last_updated: number;
}

let cachedData: Map<string, { data: OverviewMetrics; timestamp: number }> = new Map();
let chainDataCache: Map<string, { data: ChainOverviewMetrics; timestamp: number }> = new Map();

function getAllChains() {
  return l1ChainsData.map(chain => ({
    chainId: chain.chainId,
    chainName: chain.chainName,
    logoUri: chain.chainLogoURI || '',
    subnetId: chain.subnetId
  }));
}

async function getTimeSeriesData(
  metricType: string, 
  chainId: string,
  timeRange: string, 
  pageSize: number = 365,
  fetchAllPages: boolean = false
): Promise<TimeSeriesDataPoint[]> {
  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      timeInterval: "day",
      pageSize,
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      if (!fetchAllPages) {
        break;
      }
    }

    return allResults
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn(`Failed to fetch ${metricType} data for chain ${chainId}:`, error);
    return [];
  }
}

// separate active addresses fetching with proper time intervals
async function getActiveAddressesData(chainId: string, timeRange: string): Promise<TimeSeriesDataPoint[]> {
  const intervalMapping = STATS_CONFIG.ACTIVE_ADDRESSES_INTERVALS[timeRange as keyof typeof STATS_CONFIG.ACTIVE_ADDRESSES_INTERVALS];
  if (!intervalMapping) { return [] }

  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];   
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: 'activeAddresses',
      startTimestamp,
      endTimestamp,
      timeInterval: intervalMapping,
      pageSize: 1,
    };
    
    if (rlToken) { params.rltoken = rlToken; }   
    const result = await avalanche.metrics.chains.getMetrics(params);
    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      break;
    }

    return allResults
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.warn(`Failed to fetch active addresses data for chain ${chainId}:`, error);
    return [];
  }
}

async function getICMData(chainId: string, timeRange: string): Promise<ICMDataPoint[]> {
  try {
    const getDaysFromTimeRange = (range: string): number => {
      const config = STATS_CONFIG.TIME_RANGES[range as keyof typeof STATS_CONFIG.TIME_RANGES];
      if (config && 'days' in config) {
        return config.days + STATS_CONFIG.DATA_OFFSET_DAYS;
      }
      return range === 'all' ? 365 + STATS_CONFIG.DATA_OFFSET_DAYS : 30 + STATS_CONFIG.DATA_OFFSET_DAYS;
    };

    const days = getDaysFromTimeRange(timeRange);
    const response = await fetch(`https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${days}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) { return []; }
    const data = await response.json();
    if (!Array.isArray(data)) { return []; }

    return data
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((item: any) => ({
        timestamp: item.timestamp,
        date: item.date,
        messageCount: item.messageCount || 0,
        incomingCount: item.incomingCount || 0,
        outgoingCount: item.outgoingCount || 0,
      }));
  } catch (error) {
    return [];
  }
}

async function getValidatorCount(subnetId: string): Promise<number | string> {
  try {
    if (!subnetId || subnetId === "N/A") { return "N/A"; }

    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount?pageSize=1&subnetId=${subnetId}${rlToken ? `&rltoken=${rlToken}` : ''}`;   
    const validatorResponse = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
      },
    });

    if (!validatorResponse.ok) { return "N/A"; }

    const validatorData = await validatorResponse.json();
    const value = validatorData?.results?.[0]?.value;
    return value ? Number(value) : "N/A";
  } catch (error) {
    return "N/A";
  }
}

async function fetchChainMetrics(chain: any, timeRange: string): Promise<ChainOverviewMetrics | null> {
  const cacheKey = `${chain.chainId}-${timeRange}`;
  const cached = chainDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return cached.data;
  }

  try {
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;

    const [txCountData, activeAddressesData, icmData, validatorCount] = await Promise.all([
      getTimeSeriesData('txCount', chain.chainId, timeRange, pageSize, fetchAllPages),
      getActiveAddressesData(chain.chainId, timeRange),
      getICMData(chain.chainId, timeRange),
      getValidatorCount(chain.subnetId),
    ]);

    const result: ChainOverviewMetrics = {
      chainId: chain.chainId,
      chainName: chain.chainName,
      chainLogoURI: chain.logoUri,
      txCount: createTimeSeriesMetricWithPeriodSum(txCountData), // Period sum for overview
      activeAddresses: createTimeSeriesMetric(activeAddressesData),
      icmMessages: createICMMetricWithPeriodSum(icmData), // Period sum
      validatorCount,
    };

    chainDataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.warn(`Failed to fetch data for ${chain.chainName}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      chainDataCache.clear();
    }
    
    const cached = cachedData.get(timeRange);
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.LONG_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Time-Range': timeRange,
        }
      });
    }
    
    const startTime = Date.now();
    const allChains = getAllChains();
    const chainResults = await Promise.allSettled(
      allChains.map(chain => fetchChainMetrics(chain, timeRange))
    );

    const chainMetrics = chainResults
      .filter((result): result is PromiseFulfilledResult<ChainOverviewMetrics> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);

    const failedCount = chainResults.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && result.value === null)
    ).length;

    if (failedCount > 0) {
      console.warn(`${failedCount} chains failed to fetch data`);
    }

    const aggregatedTxData: TimeSeriesDataPoint[] = [];
    const aggregatedAddressData: TimeSeriesDataPoint[] = [];
    const aggregatedICMData: ICMDataPoint[] = [];

    let totalValidators = 0;
    let activeChains = 0;
    let totalTxCountAllTime = 0;
    let totalActiveAddressesAllTime = 0;
    let totalICMMessagesAllTime = 0;

    const dateMap = new Map<string, { tx: number; addresses: number; icm: number }>();
    
    chainMetrics.forEach(chain => {
      if (typeof chain.validatorCount === 'number') {
        totalValidators += chain.validatorCount;
      }
      
      const hasTx = chain.txCount.data.length > 0 && typeof chain.txCount.current_value === 'number' && chain.txCount.current_value > 0;
      const hasAddresses = chain.activeAddresses.data.length > 0 && typeof chain.activeAddresses.current_value === 'number' && chain.activeAddresses.current_value > 0;
      
      if (hasTx || hasAddresses) { activeChains++; }

      chain.txCount.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMap.get(date) || { tx: 0, addresses: 0, icm: 0 };
        current.tx += value;
        dateMap.set(date, current);
        totalTxCountAllTime += value;
      });

      chain.activeAddresses.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMap.get(date) || { tx: 0, addresses: 0, icm: 0 };
        current.addresses += value;
        dateMap.set(date, current);
        totalActiveAddressesAllTime += value;
      });

      chain.icmMessages.data.forEach(point => {
        const date = point.date;
        const current = dateMap.get(date) || { tx: 0, addresses: 0, icm: 0 };
        current.icm += point.messageCount;
        dateMap.set(date, current);
        totalICMMessagesAllTime += point.messageCount;
      });
    });

    Array.from(dateMap.entries()).forEach(([date, values]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedTxData.push({
        timestamp,
        value: values.tx,
        date
      });

      aggregatedAddressData.push({
        timestamp,
        value: values.addresses,
        date
      });

      aggregatedICMData.push({
        timestamp,
        date,
        messageCount: values.icm,
        incomingCount: 0,
        outgoingCount: 0
      });
    });

    // Sort by timestamp descending
    aggregatedTxData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedAddressData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedICMData.sort((a, b) => b.timestamp - a.timestamp);

    // Create aggregated metrics using period sum methods
    const totalTxMetric = createTimeSeriesMetricWithPeriodSum(aggregatedTxData);
    totalTxMetric.current_value = totalTxCountAllTime;

    const totalAddressMetric = createTimeSeriesMetricWithPeriodSum(aggregatedAddressData);
    totalAddressMetric.current_value = totalActiveAddressesAllTime;

    const totalICMMetric = createICMMetricWithPeriodSum(aggregatedICMData);
    totalICMMetric.current_value = totalICMMessagesAllTime;

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      aggregated: {
        totalTxCount: totalTxMetric,
        totalActiveAddresses: totalAddressMetric,
        totalICMMessages: totalICMMetric,
        totalValidators,
        activeChains
      },
      last_updated: Date.now()
    };

    cachedData.set(timeRange, {
      data: metrics,
      timestamp: Date.now()
    });

    const fetchTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Time-Range': timeRange,
        'X-Chain-Count': chainMetrics.length.toString(),
        'X-Total-Chains': allChains.length.toString(),
        'X-Failed-Chains': failedCount.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain metrics' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache',
        }
      }
    );
  }
}
