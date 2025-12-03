import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";
import { TimeSeriesDataPoint, TimeSeriesMetric, ICMDataPoint, ICMMetric, STATS_CONFIG, createTimeSeriesMetric, createICMMetric } from "@/types/stats";

const avalanche = new Avalanche({
  network: "mainnet",
});

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: TimeSeriesMetric;
  activeAddresses: {
    daily: TimeSeriesMetric;
    weekly: TimeSeriesMetric;
    monthly: TimeSeriesMetric;
  };
  icmMessages: ICMMetric;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: TimeSeriesMetric;
    totalActiveAddresses: {
      daily: TimeSeriesMetric;
      weekly: TimeSeriesMetric;
      monthly: TimeSeriesMetric;
    };
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
  chainId: string
): Promise<TimeSeriesDataPoint[]> {
  try {
    // Get timestamps for last 30 days to ensure we get latest data
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (30 * 24 * 60 * 60);
    let allResults: any[] = [];
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      timeInterval: "day",
      pageSize: 2, // Fetch 2 to get the 2nd latest (more complete data)
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      break;
    }

    const sorted = allResults.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    // Use 2nd latest (index 1) as it's more complete than the current day
    const dataPoint = sorted.length > 1 ? sorted[1] : sorted[0];
    if (!dataPoint) return [];

    return [{
      timestamp: dataPoint.timestamp,
      value: dataPoint.value || 0,
      date: new Date(dataPoint.timestamp * 1000).toISOString().split('T')[0]
    }];
  } catch (error) {
    console.warn(`Failed to fetch ${metricType} data for chain ${chainId}:`, error);
    return [];
  }
}

// separate active addresses fetching with proper time intervals
async function getActiveAddressesData(chainId: string, interval: 'day' | 'week' | 'month'): Promise<TimeSeriesDataPoint[]> {
  try {
    // Get timestamps for last 30 days to ensure we get latest data
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - (30 * 24 * 60 * 60);
    let allResults: any[] = [];   
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: 'activeAddresses',
      startTimestamp,
      endTimestamp,
      timeInterval: interval,
      pageSize: 2, // Fetch 2 to get the 2nd latest (more complete data)
    };
    
    if (rlToken) { params.rltoken = rlToken; }   
    const result = await avalanche.metrics.chains.getMetrics(params);
    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) { continue; }
      allResults = allResults.concat(page.result.results);
      break;
    }

    const sorted = allResults.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    // Use 2nd latest (index 1) as it's more complete than the current period
    const dataPoint = sorted.length > 1 ? sorted[1] : sorted[0];
    if (!dataPoint) return [];

    return [{
      timestamp: dataPoint.timestamp,
      value: dataPoint.value || 0,
      date: new Date(dataPoint.timestamp * 1000).toISOString().split('T')[0]
    }];
  } catch (error) {
    console.warn(`Failed to fetch active addresses data for chain ${chainId} with interval ${interval}:`, error);
    return [];
  }
}

async function getICMData(chainId: string): Promise<ICMDataPoint[]> {
  try {
    // Fetch 2 days to get the 2nd latest (more complete data)
    const response = await fetch(`https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=2`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) { return []; }
    const data = await response.json();
    if (!Array.isArray(data)) { return []; }

    const sorted = data.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    // Use 2nd latest (index 1) as it's more complete than the current day
    const item = sorted.length > 1 ? sorted[1] : sorted[0];
    if (!item) return [];

    return [{
      timestamp: item.timestamp,
      date: item.date,
      messageCount: item.messageCount || 0,
      incomingCount: item.incomingCount || 0,
      outgoingCount: item.outgoingCount || 0,
    }];
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

async function fetchChainMetrics(chain: any): Promise<ChainOverviewMetrics | null> {
  const cacheKey = chain.chainId;
  const cached = chainDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
    return cached.data;
  }

  try {
    // Fetch only latest data points for overview
    const [txCountData, dailyAddresses, weeklyAddresses, monthlyAddresses, icmData, validatorCount] = await Promise.all([
      getTimeSeriesData('txCount', chain.chainId),
      getActiveAddressesData(chain.chainId, 'day'),
      getActiveAddressesData(chain.chainId, 'week'),
      getActiveAddressesData(chain.chainId, 'month'),
      getICMData(chain.chainId),
      getValidatorCount(chain.subnetId),
    ]);

    const result: ChainOverviewMetrics = {
      chainId: chain.chainId,
      chainName: chain.chainName,
      chainLogoURI: chain.logoUri,
      txCount: createTimeSeriesMetric(txCountData),
      activeAddresses: {
        daily: createTimeSeriesMetric(dailyAddresses),
        weekly: createTimeSeriesMetric(weeklyAddresses),
        monthly: createTimeSeriesMetric(monthlyAddresses),
      },
      icmMessages: createICMMetric(icmData),
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
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
      chainDataCache.clear();
    }
    
    const cacheKey = 'latest';
    const cached = cachedData.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.LONG_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
        }
      });
    }
    
    const startTime = Date.now();
    const allChains = getAllChains();
    const chainResults = await Promise.allSettled(
      allChains.map(chain => fetchChainMetrics(chain))
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
    const aggregatedDailyAddressData: TimeSeriesDataPoint[] = [];
    const aggregatedWeeklyAddressData: TimeSeriesDataPoint[] = [];
    const aggregatedMonthlyAddressData: TimeSeriesDataPoint[] = [];
    const aggregatedICMData: ICMDataPoint[] = [];

    let totalValidators = 0;
    let activeChains = 0;

    // Aggregate data by date across all chains (for chart display)
    const dateMaps = {
      tx: new Map<string, number>(),
      daily: new Map<string, number>(),
      weekly: new Map<string, number>(),
      monthly: new Map<string, number>(),
      icm: new Map<string, number>(),
    };
    
    chainMetrics.forEach(chain => {
      if (typeof chain.validatorCount === 'number') {
        totalValidators += chain.validatorCount;
      }
      
      const hasTx = chain.txCount.data.length > 0 && typeof chain.txCount.current_value === 'number' && chain.txCount.current_value > 0;
      const hasAddresses = chain.activeAddresses.daily.data.length > 0 && typeof chain.activeAddresses.daily.current_value === 'number' && chain.activeAddresses.daily.current_value > 0;
      
      if (hasTx || hasAddresses) { activeChains++; }

      chain.txCount.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMaps.tx.get(date) || 0;
        dateMaps.tx.set(date, current + value);
      });

      chain.activeAddresses.daily.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMaps.daily.get(date) || 0;
        dateMaps.daily.set(date, current + value);
      });

      chain.activeAddresses.weekly.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMaps.weekly.get(date) || 0;
        dateMaps.weekly.set(date, current + value);
      });

      chain.activeAddresses.monthly.data.forEach(point => {
        const date = point.date;
        const value = typeof point.value === 'number' ? point.value : 0;
        const current = dateMaps.monthly.get(date) || 0;
        dateMaps.monthly.set(date, current + value);
      });

      chain.icmMessages.data.forEach(point => {
        const date = point.date;
        const current = dateMaps.icm.get(date) || 0;
        dateMaps.icm.set(date, current + point.messageCount);
      });
    });

    Array.from(dateMaps.tx.entries()).forEach(([date, value]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedTxData.push({ timestamp, value, date });
    });

    Array.from(dateMaps.daily.entries()).forEach(([date, value]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedDailyAddressData.push({ timestamp, value, date });
    });

    Array.from(dateMaps.weekly.entries()).forEach(([date, value]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedWeeklyAddressData.push({ timestamp, value, date });
    });

    Array.from(dateMaps.monthly.entries()).forEach(([date, value]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedMonthlyAddressData.push({ timestamp, value, date });
    });

    Array.from(dateMaps.icm.entries()).forEach(([date, messageCount]) => {
      const timestamp = Math.floor(new Date(date).getTime() / 1000);    
      aggregatedICMData.push({
        timestamp,
        date,
        messageCount,
        incomingCount: 0,
        outgoingCount: 0
      });
    });

    // Sort by timestamp descending
    aggregatedTxData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedDailyAddressData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedWeeklyAddressData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedMonthlyAddressData.sort((a, b) => b.timestamp - a.timestamp);
    aggregatedICMData.sort((a, b) => b.timestamp - a.timestamp);

    // Create aggregated metrics - current_value will be the latest daily value (first element after sort)
    const totalTxMetric = createTimeSeriesMetric(aggregatedTxData);
    const totalDailyAddressMetric = createTimeSeriesMetric(aggregatedDailyAddressData);
    const totalWeeklyAddressMetric = createTimeSeriesMetric(aggregatedWeeklyAddressData);
    const totalMonthlyAddressMetric = createTimeSeriesMetric(aggregatedMonthlyAddressData);
    const totalICMMetric = createICMMetric(aggregatedICMData);

    const metrics: OverviewMetrics = {
      chains: chainMetrics,
      aggregated: {
        totalTxCount: totalTxMetric,
        totalActiveAddresses: {
          daily: totalDailyAddressMetric,
          weekly: totalWeeklyAddressMetric,
          monthly: totalMonthlyAddressMetric,
        },
        totalICMMessages: totalICMMetric,
        totalValidators,
        activeChains
      },
      last_updated: Date.now()
    };

    cachedData.set(cacheKey, {
      data: metrics,
      timestamp: Date.now()
    });

    const fetchTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
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
