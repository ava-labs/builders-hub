import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { TimeSeriesDataPoint, TimeSeriesMetric, ICMDataPoint, ICMMetric, STATS_CONFIG,
  getTimestampsFromTimeRange, createTimeSeriesMetric, createICMMetric } from "@/types/stats";

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

let cachedData: Map<string, { data: ChainMetrics; timestamp: number; icmTimeRange: string }> = new Map();

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
    // Use provided timestamps if available, otherwise use timeRange
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
    
    const avalanche = new Avalanche({
      network: "mainnet"
    });
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: metricType as any,
      startTimestamp: finalStartTimestamp,
      endTimestamp: finalEndTimestamp,
      timeInterval: "day",
      pageSize,
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.chains.getMetrics(params);

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        console.warn(`Invalid page structure for ${metricType} on chain ${chainId}:`, page);
        continue;
      }

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

// Separate active addresses fetching with proper time intervals (optimize other metrics as needed)
async function getActiveAddressesData(chainId: string, timeRange: string, interval: 'day' | 'week' | 'month', pageSize: number = 365, fetchAllPages: boolean = false): Promise<TimeSeriesDataPoint[]> {
  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];
    
    const avalanche = new Avalanche({
      network: "mainnet"
    });
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      chainId: chainId,
      metric: 'activeAddresses',
      startTimestamp,
      endTimestamp,
      timeInterval: interval,
      pageSize,
    };
    
    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.chains.getMetrics(params);
    
    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        console.warn(`Invalid page structure for activeAddresses (${interval}) on chain ${chainId}:`, page);
        continue;
      }
      
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
    console.warn(`Failed to fetch activeAddresses data for chain ${chainId} with interval ${interval}:`, error);
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
    let days: number;
    
    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      // Calculate days from timestamps
      const startDate = new Date(startTimestamp * 1000);
      const endDate = new Date(endTimestamp * 1000);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

    const response = await fetch(`https://idx6.solokhin.com/api/${chainId}/metrics/dailyMessageVolume?days=${days}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    let filteredData = data
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((item: any) => ({
        timestamp: item.timestamp,
        date: item.date,
        messageCount: item.messageCount || 0,
        incomingCount: item.incomingCount || 0,
        outgoingCount: item.outgoingCount || 0,
      }));
    
    // Filter by timestamps if provided
    if (startTimestamp !== undefined && endTimestamp !== undefined) {
      filteredData = filteredData.filter((item: ICMDataPoint) => {
        return item.timestamp >= startTimestamp && item.timestamp <= endTimestamp;
      });
    }
    
    return filteredData;
  } catch (error) {
    console.warn(`Failed to fetch ICM data for chain ${chainId}:`, error);
    return [];
  }
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
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;
    
    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    // Parse timestamps if provided
    const startTimestamp = startTimestampParam ? parseInt(startTimestampParam, 10) : undefined;
    const endTimestamp = endTimestampParam ? parseInt(endTimestampParam, 10) : undefined;
    
    // Validate timestamps
    if (startTimestamp !== undefined && isNaN(startTimestamp)) {
      return NextResponse.json(
        { error: 'Invalid startTimestamp parameter' },
        { status: 400 }
      );
    }
    if (endTimestamp !== undefined && isNaN(endTimestamp)) {
      return NextResponse.json(
        { error: 'Invalid endTimestamp parameter' },
        { status: 400 }
      );
    }
    if (startTimestamp !== undefined && endTimestamp !== undefined && startTimestamp > endTimestamp) {
      return NextResponse.json(
        { error: 'startTimestamp must be less than or equal to endTimestamp' },
        { status: 400 }
      );
    }

    // Create cache key including timestamps if provided
    const cacheKey = startTimestamp !== undefined && endTimestamp !== undefined
      ? `${chainId}-${startTimestamp}-${endTimestamp}`
      : `${chainId}-${timeRange}`;
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }
    
    const cached = cachedData.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.LONG_DURATION) {
      // Only refetch ICM data if timeRange changed (not for timestamp-based queries)
      if (startTimestamp === undefined && endTimestamp === undefined && cached.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(chainId, timeRange, startTimestamp, endTimestamp);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = timeRange;
          cachedData.set(cacheKey, cached);
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
          'X-Chain-Id': chainId,
          'X-ICM-Refetched': cached.icmTimeRange === timeRange ? 'false' : 'true',
        }
      });
    }
    
    const startTime = Date.now();
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;
    
    const [
      dailyActiveAddressesData,
      weeklyActiveAddressesData,
      monthlyActiveAddressesData,
      activeSendersData,
      cumulativeAddressesData,
      cumulativeDeployersData,
      txCountData,
      cumulativeTxCountData,
      cumulativeContractsData,
      contractsData,
      deployersData,
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
      getActiveAddressesData(chainId, timeRange, 'day', pageSize, fetchAllPages),
      getActiveAddressesData(chainId, timeRange, 'week', pageSize, fetchAllPages),
      getActiveAddressesData(chainId, timeRange, 'month', pageSize, fetchAllPages),
      getTimeSeriesData('activeSenders', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeAddresses', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeDeployers', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('txCount', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeTxCount', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeContracts', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('contracts', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('deployers', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('gasUsed', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('avgGps', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('maxGps', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('avgTps', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('maxTps', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('avgGasPrice', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('maxGasPrice', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getTimeSeriesData('feesPaid', chainId, timeRange, startTimestamp, endTimestamp, pageSize, fetchAllPages),
      getICMData(chainId, timeRange, startTimestamp, endTimestamp),
    ]);

    const metrics: ChainMetrics = {
      activeAddresses: {
        daily: createTimeSeriesMetric(dailyActiveAddressesData),
        weekly: createTimeSeriesMetric(weeklyActiveAddressesData),
        monthly: createTimeSeriesMetric(monthlyActiveAddressesData),
      },
      activeSenders: createTimeSeriesMetric(activeSendersData), 
      cumulativeAddresses: createTimeSeriesMetric(cumulativeAddressesData), 
      cumulativeDeployers: createTimeSeriesMetric(cumulativeDeployersData), 
      txCount: createTimeSeriesMetric(txCountData), 
      cumulativeTxCount: createTimeSeriesMetric(cumulativeTxCountData), 
      cumulativeContracts: createTimeSeriesMetric(cumulativeContractsData), 
      contracts: createTimeSeriesMetric(contractsData), 
      deployers: createTimeSeriesMetric(deployersData), 
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

    cachedData.set(cacheKey, {
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
        'X-Chain-Id': chainId,
        'X-All-Pages': fetchAllPages.toString(),
      }
    });
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;

    console.error(`Error in chain-stats API for chain ${chainId}:`, error);
    
    const fallbackTimeRange = '30d';
    const fallbackCacheKey = `${chainId}-${fallbackTimeRange}`;
    const cached = cachedData.get(fallbackCacheKey);
    
    if (cached) {
      if (cached.icmTimeRange !== fallbackTimeRange) {
        try {
          const newICMData = await getICMData(chainId, fallbackTimeRange, undefined, undefined);
          cached.data.icmMessages = createICMMetric(newICMData);
          cached.icmTimeRange = fallbackTimeRange;
          cachedData.set(fallbackCacheKey, cached);
        } catch (icmError) {
          console.warn('Failed to fetch new ICM data in error fallback:', icmError);
        }
      }
      
      return NextResponse.json(cached.data, {
        status: 206,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Data-Source': 'fallback-cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Time-Range': fallbackTimeRange,
          'X-Chain-Id': chainId,
          'X-Error': 'true',
        }
      });
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch chain metrics', 
        details: error instanceof Error ? error.message : 'Unknown error',
        chainId: chainId,
        timeRange: timeRange
      },
      { status: 500 }
    );
  }
}
