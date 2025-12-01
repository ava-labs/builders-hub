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
      metric: metricType as any,
      startTimestamp: finalStartTimestamp,
      endTimestamp: finalEndTimestamp,
      timeInterval: "day",
      pageSize,
    };
    
    // Only add chainId if it's not "all" - when "all" is selected, we don't pass chainId
    // to get aggregated metrics across all chains
    if (chainId !== "all") {
      params.chainId = chainId;
    } else {
      params.chainId = "mainnet";
    }
    
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
    // Use provided timestamps if available, otherwise use timeRange
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
    
    const avalanche = new Avalanche({
      network: "mainnet"
    });
    
    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      metric: 'activeAddresses',
      startTimestamp,
      endTimestamp,
      timeInterval: interval,
      pageSize,
    };
    
    // Only add chainId if it's not "all" - when "all" is selected, we don't pass chainId
    // to get aggregated metrics across all chains
    if (chainId !== "all") {
      params.chainId = chainId;
    } else {
      params.chainId = "mainnet";
    }
    
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
    // Use "global" instead of chainId when "all" is selected for aggregated ICM data
    const apiChainId = chainId === "all" ? "global" : chainId;
    
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

    const response = await fetch(`https://idx6.solokhin.com/api/${apiChainId}/metrics/dailyMessageVolume?days=${days}`, {
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


// List of all available metrics (for validation and fetching all)
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
] as const;

type MetricKey = typeof ALL_METRICS[number];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const startTimestampParam = searchParams.get('startTimestamp');
    const endTimestampParam = searchParams.get('endTimestamp');
    const metricsParam = searchParams.get('metrics'); // Comma-separated list of metrics to fetch
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

    // Parse requested metrics - if not provided, fetch all metrics (backward compatibility)
    const requestedMetrics: MetricKey[] = metricsParam
      ? metricsParam.split(',').filter((m): m is MetricKey => ALL_METRICS.includes(m as MetricKey))
      : [...ALL_METRICS];
    
    if (metricsParam && requestedMetrics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid metrics parameter. Valid metrics: ' + ALL_METRICS.join(', ') },
        { status: 400 }
      );
    }

    // Create cache key including timestamps and metrics if provided
    const metricsKey = requestedMetrics.sort().join(',');
    const cacheKey = startTimestamp !== undefined && endTimestamp !== undefined
      ? `${chainId}-${startTimestamp}-${endTimestamp}-${metricsKey}`
      : `${chainId}-${timeRange}-${metricsKey}`;
    
    if (searchParams.get('clearCache') === 'true') {
      cachedData.clear();
    }
    
    const cached = cachedData.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.LONG_DURATION) {
      // Only refetch ICM data if timeRange changed (not for timestamp-based queries)
      if (requestedMetrics.includes('icmMessages') && startTimestamp === undefined && endTimestamp === undefined && cached.icmTimeRange !== timeRange) {
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
          'X-Metrics': requestedMetrics.join(','),
        }
      });
    }
    
    const startTime = Date.now();
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;
    
    // Build fetch promises only for requested metrics
    const fetchPromises: { [key: string]: Promise<TimeSeriesDataPoint[] | ICMDataPoint[]> } = {};
    
    // Determine if we're in "specific metrics" mode (metricsParam provided) or "all metrics" mode (backward compatibility)
    const isSpecificMetricsMode = metricsParam !== null;
    
    // activeAddresses is special - when all metrics are fetched, it has daily/weekly/monthly variants
    // When specifically requested, only fetch daily and return as flat structure (for ConfigurableChart compatibility)
    if (requestedMetrics.includes('activeAddresses')) {
      fetchPromises['dailyActiveAddresses'] = getActiveAddressesData(chainId, timeRange, 'day', startTimestamp, endTimestamp, pageSize, fetchAllPages);
      if (!isSpecificMetricsMode) {
        // Only fetch weekly/monthly when in backward compatibility mode (all metrics)
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
    
    // Fetch all requested metrics in parallel
    const fetchKeys = Object.keys(fetchPromises);
    const fetchResults = await Promise.all(Object.values(fetchPromises));
    
    // Map results back to keys
    const results: { [key: string]: TimeSeriesDataPoint[] | ICMDataPoint[] } = {};
    fetchKeys.forEach((key, index) => {
      results[key] = fetchResults[index];
    });

    // Build metrics object with only requested metrics
    const metrics: Partial<ChainMetrics> & { activeAddresses?: any } = {
      last_updated: Date.now()
    };
    
    if (requestedMetrics.includes('activeAddresses')) {
      if (isSpecificMetricsMode) {
        // When specifically requested (e.g., from ConfigurableChart), return as flat TimeSeriesMetric
        // This maintains compatibility with components that expect a flat structure
        metrics.activeAddresses = createTimeSeriesMetric(results['dailyActiveAddresses'] as TimeSeriesDataPoint[]);
      } else {
        // When all metrics are fetched (backward compatibility), return nested structure
        metrics.activeAddresses = {
          daily: createTimeSeriesMetric(results['dailyActiveAddresses'] as TimeSeriesDataPoint[]),
          weekly: createTimeSeriesMetric(results['weeklyActiveAddresses'] as TimeSeriesDataPoint[]),
          monthly: createTimeSeriesMetric(results['monthlyActiveAddresses'] as TimeSeriesDataPoint[]),
        };
      }
    }
    
    if (requestedMetrics.includes('activeSenders')) {
      metrics.activeSenders = createTimeSeriesMetric(results['activeSenders'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('cumulativeAddresses')) {
      metrics.cumulativeAddresses = createTimeSeriesMetric(results['cumulativeAddresses'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('cumulativeDeployers')) {
      metrics.cumulativeDeployers = createTimeSeriesMetric(results['cumulativeDeployers'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('txCount')) {
      metrics.txCount = createTimeSeriesMetric(results['txCount'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('cumulativeTxCount')) {
      metrics.cumulativeTxCount = createTimeSeriesMetric(results['cumulativeTxCount'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('cumulativeContracts')) {
      metrics.cumulativeContracts = createTimeSeriesMetric(results['cumulativeContracts'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('contracts')) {
      metrics.contracts = createTimeSeriesMetric(results['contracts'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('deployers')) {
      metrics.deployers = createTimeSeriesMetric(results['deployers'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('gasUsed')) {
      metrics.gasUsed = createTimeSeriesMetric(results['gasUsed'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('avgGps')) {
      metrics.avgGps = createTimeSeriesMetric(results['avgGps'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('maxGps')) {
      metrics.maxGps = createTimeSeriesMetric(results['maxGps'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('avgTps')) {
      metrics.avgTps = createTimeSeriesMetric(results['avgTps'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('maxTps')) {
      metrics.maxTps = createTimeSeriesMetric(results['maxTps'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('avgGasPrice')) {
      metrics.avgGasPrice = createTimeSeriesMetric(results['avgGasPrice'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('maxGasPrice')) {
      metrics.maxGasPrice = createTimeSeriesMetric(results['maxGasPrice'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('feesPaid')) {
      metrics.feesPaid = createTimeSeriesMetric(results['feesPaid'] as TimeSeriesDataPoint[]);
    }
    if (requestedMetrics.includes('icmMessages')) {
      metrics.icmMessages = createICMMetric(results['icmMessages'] as ICMDataPoint[]);
    }

    cachedData.set(cacheKey, {
      data: metrics as ChainMetrics,
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
        'X-Metrics': requestedMetrics.join(','),
      }
    });
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const metricsParam = searchParams.get('metrics');
    const resolvedParams = await params;
    const chainId = resolvedParams.chainId;

    console.error(`Error in chain-stats API for chain ${chainId}:`, error);
    
    const fallbackTimeRange = '30d';
    const metricsKey = metricsParam || ALL_METRICS.join(',');
    const fallbackCacheKey = `${chainId}-${fallbackTimeRange}-${metricsKey}`;
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
