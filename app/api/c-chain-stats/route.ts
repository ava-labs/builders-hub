import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";

const avalanche = new Avalanche({
  chainId: "43114",
});

interface TimeSeriesDataPoint {
  timestamp: number;
  value: number | string;
  date: string;
}

interface TimeSeriesMetric {
  data: TimeSeriesDataPoint[];
  current_value: number | string;
  change_24h: number;
  change_percentage_24h: number;
}

interface ICMDataPoint {
  timestamp: number;
  date: string;
  messageCount: number;
  incomingCount: number;
  outgoingCount: number;
}

interface ICMMetric {
  data: ICMDataPoint[];
  current_value: number;
  change_24h: number;
  change_percentage_24h: number;
}

interface CChainMetrics {
  activeAddresses: TimeSeriesMetric;
  activeSenders: TimeSeriesMetric;
  cumulativeAddresses: TimeSeriesMetric;
  cumulativeDeployers: TimeSeriesMetric;
  txCount: TimeSeriesMetric;
  cumulativeTxCount: TimeSeriesMetric;
  cumulativeContracts: TimeSeriesMetric;
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

let cachedData: Map<string, { data: CChainMetrics; timestamp: number; icmTimeRange: string }> = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

function getTimestampsFromTimeRange(timeRange: string): { startTimestamp: number; endTimestamp: number } {
  const now = Math.floor(Date.now() / 1000);
  let startTimestamp: number;
  
  switch (timeRange) {
    case '7d':
      startTimestamp = now - (7 * 24 * 60 * 60);
      break;
    case '30d':
      startTimestamp = now - (30 * 24 * 60 * 60);
      break;
    case '90d':
      startTimestamp = now - (90 * 24 * 60 * 60);
      break;
    case 'all':
      startTimestamp = 1600646400;
      break;
    default:
      startTimestamp = now - (30 * 24 * 60 * 60);
  }
  
  return {
    startTimestamp,
    endTimestamp: now
  };
}

async function getTimeSeriesData(metricType: string, timeRange: string, pageSize: number = 365, fetchAllPages: boolean = false): Promise<TimeSeriesDataPoint[]> {
  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];
    let pageCount = 0;
    const maxPages = 50;
    
    const result = await avalanche.metrics.chains.getMetrics({
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      timeInterval: "day",
      pageSize,
    });

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        console.warn(`Invalid page structure for ${metricType}:`, page);
        continue;
      }

      allResults = allResults.concat(page.result.results);
      pageCount++;
      
      if (!fetchAllPages) {
        break;
      }
      
      if (pageCount >= maxPages) {
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
    console.warn(`Failed to fetch ${metricType} data:`, error);
    return [];
  }
}

function createTimeSeriesMetric(data: TimeSeriesDataPoint[]): TimeSeriesMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 'N/A',
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const current = data[0];
  const previous = data.length > 1 ? data[1] : current;
  
  const currentVal = typeof current.value === 'string' ? parseFloat(current.value) : current.value;
  const previousVal = typeof previous.value === 'string' ? parseFloat(previous.value) : previous.value;
  
  const change = currentVal - previousVal;
  const changePercentage = previousVal !== 0 ? (change / previousVal) * 100 : 0;

  return {
    data,
    current_value: current.value,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}



async function getICMData(timeRange: string): Promise<ICMDataPoint[]> {
  try {
    const getDaysFromTimeRange = (range: string): number => {
      switch (range) {
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        case 'all': return 365;
        default: return 30;
      }
    };

    const days = getDaysFromTimeRange(timeRange);
    const response = await fetch(`https://idx6.solokhin.com/api/global/metrics/dailyMessageVolume?days=${days}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

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

function createICMMetric(data: ICMDataPoint[]): ICMMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 0,
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const current = data[0];
  const previous = data.length > 1 ? data[1] : current;
  
  const change = current.messageCount - previous.messageCount;
  const changePercentage = previous.messageCount !== 0 ? (change / previous.messageCount) * 100 : 0;

  return {
    data,
    current_value: current.messageCount,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }
    
    const cached = cachedData.get(timeRange);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      if (cached.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(timeRange);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = timeRange;
          cachedData.set(timeRange, cached);
        } catch (error) {
          console.warn('Failed to fetch new ICM data, using cached data:', error);
        }
      }
      
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Time-Range': timeRange,
          'X-ICM-Refetched': cached.icmTimeRange === timeRange ? 'false' : 'true',
        }
      });
    }
    
    const startTime = Date.now();
    const fetchAllPages = timeRange === 'all' || timeRange === '90d' || timeRange === '30d';
    const pageSize = timeRange === 'all' ? 2000 : timeRange === '90d' ? 500 : 365;
    const [
      activeAddressesData,
      activeSendersData,
      cumulativeAddressesData,
      cumulativeDeployersData,
      txCountData,
      cumulativeTxCountData,
      cumulativeContractsData,
      gasUsedData,
      avgGpsData,
      maxGpsData,
      avgTpsData,
      maxTpsData,
      avgGasPriceData,
      maxGasPriceData,
      feesPaidData,
      icmData,
    ] = await Promise.all([
      getTimeSeriesData('activeAddresses', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('activeSenders', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeAddresses', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeDeployers', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('txCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeTxCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeContracts', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('gasUsed', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgGps', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxGps', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgTps', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxTps', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgGasPrice', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxGasPrice', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('feesPaid', timeRange, pageSize, fetchAllPages),
      getICMData(timeRange),
    ]);

    const metrics: CChainMetrics = {
      activeAddresses: createTimeSeriesMetric(activeAddressesData),
      activeSenders: createTimeSeriesMetric(activeSendersData),
      cumulativeAddresses: createTimeSeriesMetric(cumulativeAddressesData),
      cumulativeDeployers: createTimeSeriesMetric(cumulativeDeployersData),
      txCount: createTimeSeriesMetric(txCountData),
      cumulativeTxCount: createTimeSeriesMetric(cumulativeTxCountData),
      cumulativeContracts: createTimeSeriesMetric(cumulativeContractsData),
      gasUsed: createTimeSeriesMetric(gasUsedData),
      avgGps: createTimeSeriesMetric(avgGpsData),
      maxGps: createTimeSeriesMetric(maxGpsData),
      avgTps: createTimeSeriesMetric(avgTpsData),
      maxTps: createTimeSeriesMetric(maxTpsData),
      avgGasPrice: createTimeSeriesMetric(avgGasPriceData),
      maxGasPrice: createTimeSeriesMetric(maxGasPriceData),
      feesPaid: createTimeSeriesMetric(feesPaidData),
      icmMessages: createICMMetric(icmData),
      last_updated: Date.now()
    };

    cachedData.set(timeRange, {
      data: metrics,
      timestamp: Date.now(),
      icmTimeRange: timeRange
    });

    const fetchTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Cache-Timestamp': new Date().toISOString(),
        'X-Time-Range': timeRange,
        'X-All-Pages': fetchAllPages.toString(),
      }
    });
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const fallbackTimeRange = searchParams.get('timeRange') || '30d';
    const cached = cachedData.get(fallbackTimeRange);
    if (cached) {
      if (cached.icmTimeRange !== fallbackTimeRange) {
        try {
          const newICMData = await getICMData(fallbackTimeRange);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = fallbackTimeRange;
          cachedData.set(fallbackTimeRange, cached);
        } catch (icmError) {
          console.warn('Failed to fetch new ICM data in error fallback:', icmError);
        }
      }
      
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Data-Source': 'cache-fallback',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Error': 'true',
          'X-Time-Range': fallbackTimeRange,
          'X-ICM-Refetched': cached.icmTimeRange === fallbackTimeRange ? 'false' : 'true',
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch C-Chain stats' },
      { status: 500 }
    );
  }
}