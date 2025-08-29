import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";

const avalanche = new Avalanche({
  network: "mainnet",
  apiKey: process.env.GLACIER_API_KEY,
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

interface PrimaryNetworkMetrics {
  validator_count: TimeSeriesMetric;
  validator_weight: TimeSeriesMetric;
  delegator_count: TimeSeriesMetric;
  delegator_weight: TimeSeriesMetric;
  validator_versions: string;
  last_updated: number;
}

let cachedData: Map<string, { data: PrimaryNetworkMetrics; timestamp: number }> = new Map();
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
    
    const result = await avalanche.metrics.networks.getStakingMetrics({
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      pageSize,
    });

    for await (const page of result) {
      if (!page?.result?.results || !Array.isArray(page.result.results)) {
        console.warn(`Invalid page structure for ${metricType}:`, page);
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



async function fetchValidatorVersions() {
  try {
    const result = await avalanche.data.primaryNetwork.getNetworkDetails({});
    
    if (!result?.validatorDetails?.stakingDistributionByVersion) {
      console.error('No stakingDistributionByVersion found in SDK response');
      return {};
    }

    const versionData: { [key: string]: { validatorCount: number; amountStaked: string } } = {};
    result.validatorDetails.stakingDistributionByVersion.forEach((item: any) => {
      if (item.version && item.validatorCount) {
        versionData[item.version] = {
          validatorCount: item.validatorCount,
          amountStaked: item.amountStaked
        };
      }
    });

    return versionData;
  } catch (error) {
    console.error('Error fetching validator versions:', error);
    return {};
  }
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
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Time-Range': timeRange,
        }
      });
    }
    
    const startTime = Date.now();
    const fetchAllPages = timeRange === 'all' || timeRange === '90d' || timeRange === '30d';
    const pageSize = timeRange === 'all' ? 2000 : timeRange === '90d' ? 500 : 365;

    const [
      validatorCountData,
      validatorWeightData,
      delegatorCountData,
      delegatorWeightData,
      validatorVersions
    ] = await Promise.all([
      getTimeSeriesData('validatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('validatorWeight', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorCount', timeRange, pageSize, fetchAllPages),
      getTimeSeriesData('delegatorWeight', timeRange, pageSize, fetchAllPages),
      fetchValidatorVersions()
    ]);

    const validatorVersionsJson = JSON.stringify(validatorVersions);

    const metrics: PrimaryNetworkMetrics = {
      validator_count: createTimeSeriesMetric(validatorCountData),
      validator_weight: createTimeSeriesMetric(validatorWeightData),
      delegator_count: createTimeSeriesMetric(delegatorCountData),
      delegator_weight: createTimeSeriesMetric(delegatorWeightData),
      validator_versions: validatorVersionsJson,
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
    console.error('Error in primary-network-stats API:', error);
    
    const { searchParams } = new URL(request.url);
    const fallbackTimeRange = searchParams.get('timeRange') || '30d';
    const cached = cachedData.get(fallbackTimeRange);
    
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Data-Source': 'cache-fallback',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Error': 'true',
          'X-Time-Range': fallbackTimeRange,
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch primary network stats' },
      { status: 500 }
    );
  }
}