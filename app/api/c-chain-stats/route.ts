import { NextResponse } from 'next/server';

const C_CHAIN_ID = "43114";

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

let cachedData: { data: CChainMetrics; timestamp: number; icmTimeRange: string } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function getTimeSeriesData(metricType: string, pageSize: number = 365, fetchAllPages: boolean = false): Promise<TimeSeriesDataPoint[]> {
  try {
    let allResults: any[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    const maxPages = 50;
    
    do {
      let url = `https://metrics.avax.network/v2/chains/${C_CHAIN_ID}/metrics/${metricType}?pageSize=${pageSize}&timeInterval=day`;
      if (nextPageToken) {
        url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        break;
      }

      const data = await response.json();
      if (!data?.results || !Array.isArray(data.results)) {
        break;
      }

      allResults = allResults.concat(data.results);
      nextPageToken = data.nextPageToken || null;
      pageCount++;
      
      if (!fetchAllPages) {
        break;
      }
      
      if (pageCount >= maxPages) {
        break;
      }
      
    } while (nextPageToken && fetchAllPages);

    return allResults
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
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

function filterDataByTimeRange(data: TimeSeriesDataPoint[], days: number): TimeSeriesDataPoint[] {
  if (days === 0) return data;
  
  const cutoffTimestamp = Date.now() / 1000 - (days * 24 * 60 * 60);
  return data.filter(point => point.timestamp >= cutoffTimestamp);
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
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      // Check if we need to refetch ICM data due to different timeRange
      if (cachedData.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(timeRange);
          cachedData.data.icmMessages = createICMMetric(newICMData);
          cachedData.icmTimeRange = timeRange;
        } catch (error) {
          console.warn('Failed to fetch new ICM data, using cached data:', error);
        }
      }
      
      const filteredData = filterCachedDataByTimeRange(cachedData.data, timeRange);
      return NextResponse.json(filteredData, {
        headers: {
          'Cache-Control': `public, max-age=${Math.floor(CACHE_DURATION / 1000)}, stale-while-revalidate=300`,
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
          'X-Time-Range': timeRange,
          'X-ICM-Refetched': cachedData.icmTimeRange === timeRange ? 'false' : 'true',
        }
      });
    }
    
    const startTime = Date.now();

    const fetchAllPages = timeRange === 'all';
    const pageSize = fetchAllPages ? 1000 : 365;
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
      getTimeSeriesData('activeAddresses', pageSize, fetchAllPages),
      getTimeSeriesData('activeSenders', pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeAddresses', pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeDeployers', pageSize, fetchAllPages),
      getTimeSeriesData('txCount', pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeTxCount', pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeContracts', pageSize, fetchAllPages),
      getTimeSeriesData('gasUsed', pageSize, fetchAllPages),
      getTimeSeriesData('avgGps', pageSize, fetchAllPages),
      getTimeSeriesData('maxGps', pageSize, fetchAllPages),
      getTimeSeriesData('avgTps', pageSize, fetchAllPages),
      getTimeSeriesData('maxTps', pageSize, fetchAllPages),
      getTimeSeriesData('avgGasPrice', pageSize, fetchAllPages),
      getTimeSeriesData('maxGasPrice', pageSize, fetchAllPages),
      getTimeSeriesData('feesPaid', pageSize, fetchAllPages),
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

    cachedData = {
      data: metrics,
      timestamp: Date.now(),
      icmTimeRange: timeRange
    };

    const filteredData = filterCachedDataByTimeRange(metrics, timeRange);
    const fetchTime = Date.now() - startTime;

    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': `public, max-age=${Math.floor(CACHE_DURATION / 1000)}, stale-while-revalidate=300`,
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Cache-Timestamp': new Date().toISOString(),
        'X-Time-Range': timeRange,
        'X-All-Pages': fetchAllPages.toString(),
      }
    });
  } catch (error) {
    if (cachedData) {
      const { searchParams } = new URL(request.url);
      const timeRange = searchParams.get('timeRange') || '30d';

      if (cachedData.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(timeRange);
          cachedData.data.icmMessages = createICMMetric(newICMData);
          cachedData.icmTimeRange = timeRange;
        } catch (icmError) {
          console.warn('Failed to fetch new ICM data in error fallback:', icmError);
        }
      }
      
      const filteredData = filterCachedDataByTimeRange(cachedData.data, timeRange);
      return NextResponse.json(filteredData, {
        headers: {
          'Cache-Control': `public, max-age=${Math.floor(CACHE_DURATION / 2000)}, stale-while-revalidate=300`,
          'X-Data-Source': 'cache-fallback',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
          'X-Error': 'true',
          'X-Time-Range': timeRange,
          'X-ICM-Refetched': cachedData.icmTimeRange === timeRange ? 'false' : 'true',
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch C-Chain stats' },
      { status: 500 }
    );
  }
}



function filterCachedDataByTimeRange(data: CChainMetrics, timeRange: string): CChainMetrics {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 0;
  
  return {
    ...data,
    activeAddresses: {
      ...data.activeAddresses,
      data: filterDataByTimeRange(data.activeAddresses.data, days)
    },
    activeSenders: {
      ...data.activeSenders,
      data: filterDataByTimeRange(data.activeSenders.data, days)
    },
    cumulativeAddresses: {
      ...data.cumulativeAddresses,
      data: filterDataByTimeRange(data.cumulativeAddresses.data, days)
    },
    cumulativeDeployers: {
      ...data.cumulativeDeployers,
      data: filterDataByTimeRange(data.cumulativeDeployers.data, days)
    },
    txCount: {
      ...data.txCount,
      data: filterDataByTimeRange(data.txCount.data, days)
    },
    cumulativeTxCount: {
      ...data.cumulativeTxCount,
      data: filterDataByTimeRange(data.cumulativeTxCount.data, days)
    },
    cumulativeContracts: {
      ...data.cumulativeContracts,
      data: filterDataByTimeRange(data.cumulativeContracts.data, days)
    },
    gasUsed: {
      ...data.gasUsed,
      data: filterDataByTimeRange(data.gasUsed.data, days)
    },
    avgGps: {
      ...data.avgGps,
      data: filterDataByTimeRange(data.avgGps.data, days)
    },
    maxGps: {
      ...data.maxGps,
      data: filterDataByTimeRange(data.maxGps.data, days)
    },
    avgTps: {
      ...data.avgTps,
      data: filterDataByTimeRange(data.avgTps.data, days)
    },
    maxTps: {
      ...data.maxTps,
      data: filterDataByTimeRange(data.maxTps.data, days)
    },
    avgGasPrice: {
      ...data.avgGasPrice,
      data: filterDataByTimeRange(data.avgGasPrice.data, days)
    },
    maxGasPrice: {
      ...data.maxGasPrice,
      data: filterDataByTimeRange(data.maxGasPrice.data, days)
    },
    feesPaid: {
      ...data.feesPaid,
      data: filterDataByTimeRange(data.feesPaid.data, days)
    },
    icmMessages: data.icmMessages
  };
}