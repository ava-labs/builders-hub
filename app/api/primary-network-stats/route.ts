import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { TimeSeriesDataPoint, TimeSeriesMetric, STATS_CONFIG, getTimestampsFromTimeRange, createTimeSeriesMetric } from "@/types/stats";

interface PrimaryNetworkMetrics {
  validator_count: TimeSeriesMetric;
  validator_weight: TimeSeriesMetric;
  delegator_count: TimeSeriesMetric;
  delegator_weight: TimeSeriesMetric;
  validator_versions: string;
  last_updated: number;
}

const avalanche = new Avalanche({
  network: "mainnet"
});

let cachedData: Map<string, { data: PrimaryNetworkMetrics; timestamp: number }> = new Map();

async function getTimeSeriesData(metricType: string, timeRange: string, pageSize: number = 365, fetchAllPages: boolean = false): Promise<TimeSeriesDataPoint[]> {
  try {
    const { startTimestamp, endTimestamp } = getTimestampsFromTimeRange(timeRange);
    let allResults: any[] = [];

    const rlToken = process.env.METRICS_BYPASS_TOKEN || '';
    const params: any = {
      metric: metricType as any,
      startTimestamp,
      endTimestamp,
      pageSize,
    };

    if (rlToken) { params.rltoken = rlToken; }
    
    const result = await avalanche.metrics.networks.getStakingMetrics(params);

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
    
    if (cached && Date.now() - cached.timestamp < STATS_CONFIG.CACHE.SHORT_DURATION) {
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
    const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES] || STATS_CONFIG.TIME_RANGES['30d'];
    const { pageSize, fetchAllPages } = config;

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