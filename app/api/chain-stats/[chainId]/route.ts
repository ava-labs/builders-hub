import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { TimeSeriesDataPoint, TimeSeriesMetric, ICMDataPoint, ICMMetric, STATS_CONFIG,
  getTimestampsFromTimeRange, createTimeSeriesMetric, createICMMetric } from "@/types/stats";

interface ChainMetrics {
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

let cachedData: Map<string, { data: ChainMetrics; timestamp: number; icmTimeRange: string }> = new Map();

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
    
    const avalanche = new Avalanche({
      network: "mainnet"
    });
    
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

async function getICMData(chainId: string, timeRange: string): Promise<ICMDataPoint[]> {
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
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;
    
    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const cacheKey = `${chainId}-${timeRange}`;
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }
    
    const cached = cachedData.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.LONG_DURATION) {
      if (cached.icmTimeRange !== timeRange) {
        try {
          const newICMData = await getICMData(chainId, timeRange);
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
      getTimeSeriesData('activeAddresses', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('activeSenders', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeAddresses', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeDeployers', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('txCount', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeTxCount', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('cumulativeContracts', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('gasUsed', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgGps', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxGps', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgTps', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxTps', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('avgGasPrice', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('maxGasPrice', chainId, timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('feesPaid', chainId, timeRange, pageSize, fetchAllPages),
      getICMData(chainId, timeRange),
    ]);

    const metrics: ChainMetrics = {
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
          const newICMData = await getICMData(chainId, fallbackTimeRange);
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
