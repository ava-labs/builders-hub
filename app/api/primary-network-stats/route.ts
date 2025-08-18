import { NextResponse } from 'next/server';

const GLACIER_API_KEY = process.env.GLACIER_API_KEY;
const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

interface TimeSeriesDataPoint {
  timestamp: number;
  value: number | string;
  date: string; // ISO date string for easy formatting
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

let cachedData: { data: PrimaryNetworkMetrics; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

async function getTimeSeriesData(metricType: string, pageSize: number = 365): Promise<TimeSeriesDataPoint[]> {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/${metricType}?pageSize=${pageSize}&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return [];

    return data.results
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((result: any) => ({
        timestamp: result.timestamp,
        value: result.value || 0,
        date: new Date(result.timestamp * 1000).toISOString().split('T')[0]
      }));
  } catch (error) {
    console.error(`Error fetching ${metricType}:`, error);
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
  if (days === 0) return data; // All time
  
  const cutoffTimestamp = Date.now() / 1000 - (days * 24 * 60 * 60);
  return data.filter(point => point.timestamp >= cutoffTimestamp);
}

async function fetchValidatorVersions() {
  if (!GLACIER_API_KEY) {
    console.error('GLACIER_API_KEY is missing');
    return {};
  }

  try {
    console.log('Fetching validator versions from Glacier API...');
    const response = await fetch('https://glacier-api.avax.network/v1/networks/mainnet', {
      headers: {
        'x-glacier-api-key': GLACIER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Glacier API failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return {};
    }

    const data = await response.json();
    console.log('Full Glacier API response:', JSON.stringify(data, null, 2));

    if (!data?.validatorDetails) {
      console.error('No validatorDetails found in response');
      return {};
    }

    if (!data?.validatorDetails?.stakingDistributionByVersion) {
      console.error('No stakingDistributionByVersion found in validatorDetails');
      console.log('Available validatorDetails keys:', Object.keys(data.validatorDetails));
      return {};
    }

    const versionData: { [key: string]: { validatorCount: number; amountStaked: string } } = {};
    data.validatorDetails.stakingDistributionByVersion.forEach((item: any) => {
      if (item.version && item.validatorCount) {
        versionData[item.version] = {
          validatorCount: item.validatorCount,
          amountStaked: item.amountStaked
        };
        console.log(`Added version: ${item.version} with ${item.validatorCount} validators`);
      }
    });

    console.log('Final version data:', versionData);
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
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      // Filter cached data by requested time range
      const filteredData = filterCachedDataByTimeRange(cachedData.data, timeRange);
      return NextResponse.json(filteredData, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
          'X-Time-Range': timeRange,
        }
      });
    }
    
    const startTime = Date.now();

    const [
      validatorCountData,
      validatorWeightData,
      delegatorCountData,
      delegatorWeightData,
      validatorVersions
    ] = await Promise.all([
      getTimeSeriesData('validatorCount', 365),
      getTimeSeriesData('validatorWeight', 365),
      getTimeSeriesData('delegatorCount', 365),
      getTimeSeriesData('delegatorWeight', 365),
      fetchValidatorVersions()
    ]);

    const validatorVersionsJson = JSON.stringify(validatorVersions);
    console.log('Validator versions JSON:', validatorVersionsJson);

    const metrics: PrimaryNetworkMetrics = {
      validator_count: createTimeSeriesMetric(validatorCountData),
      validator_weight: createTimeSeriesMetric(validatorWeightData),
      delegator_count: createTimeSeriesMetric(delegatorCountData),
      delegator_weight: createTimeSeriesMetric(delegatorWeightData),
      validator_versions: validatorVersionsJson,
      last_updated: Date.now()
    };

    cachedData = {
      data: metrics,
      timestamp: Date.now()
    };

    const filteredData = filterCachedDataByTimeRange(metrics, timeRange);
    const fetchTime = Date.now() - startTime;

    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Cache-Timestamp': new Date().toISOString(),
        'X-Time-Range': timeRange,
      }
    });
  } catch (error) {
    console.error('Error in primary-network-stats API:', error);
    
    if (cachedData) {
      const { searchParams } = new URL(request.url);
      const timeRange = searchParams.get('timeRange') || '30d';
      const filteredData = filterCachedDataByTimeRange(cachedData.data, timeRange);
      return NextResponse.json(filteredData, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
          'X-Data-Source': 'cache-fallback',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
          'X-Error': 'true',
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch primary network stats' },
      { status: 500 }
    );
  }
}

function filterCachedDataByTimeRange(data: PrimaryNetworkMetrics, timeRange: string): PrimaryNetworkMetrics {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 0;
  
  return {
    ...data,
    validator_count: {
      ...data.validator_count,
      data: filterDataByTimeRange(data.validator_count.data, days)
    },
    validator_weight: {
      ...data.validator_weight,
      data: filterDataByTimeRange(data.validator_weight.data, days)
    },
    delegator_count: {
      ...data.delegator_count,
      data: filterDataByTimeRange(data.delegator_count.data, days)
    },
    delegator_weight: {
      ...data.delegator_weight,
      data: filterDataByTimeRange(data.delegator_weight.data, days)
    }
  };
}