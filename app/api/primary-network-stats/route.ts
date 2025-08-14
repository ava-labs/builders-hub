import { NextResponse } from 'next/server';

const GLACIER_API_KEY = process.env.GLACIER_API_KEY;
const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

interface PrimaryNetworkMetrics {
  validator_versions: string;
  delegator_count_day1: number | string;
  delegator_count_day2: number | string;
  delegator_count_day3: number | string;
  delegator_count_day4: number | string;
  delegator_count_day5: number | string;
  delegator_count_day6: number | string;
  delegator_count_day7: number | string;
  delegator_count_day8: number | string;
  delegator_count_day9: number | string;
  delegator_count_day10: number | string;
  delegator_count_day11: number | string;
  delegator_count_day12: number | string;
  delegator_count_day13: number | string;
  delegator_count_day14: number | string;
  delegator_count_day15: number | string;
  delegator_count_day16: number | string;
  delegator_count_day17: number | string;
  delegator_count_day18: number | string;
  delegator_count_day19: number | string;
  delegator_count_day20: number | string;
  delegator_count_day21: number | string;
  delegator_count_day22: number | string;
  delegator_count_day23: number | string;
  delegator_count_day24: number | string;
  delegator_count_day25: number | string;
  delegator_count_day26: number | string;
  delegator_count_day27: number | string;
  delegator_count_day28: number | string;
  delegator_count_day29: number | string;
  delegator_count_day30: number | string;
  delegator_weight_day1: number | string;
  delegator_weight_day2: number | string;
  delegator_weight_day3: number | string;
  delegator_weight_day4: number | string;
  delegator_weight_day5: number | string;
  delegator_weight_day6: number | string;
  delegator_weight_day7: number | string;
  delegator_weight_day8: number | string;
  delegator_weight_day9: number | string;
  delegator_weight_day10: number | string;
  delegator_weight_day11: number | string;
  delegator_weight_day12: number | string;
  delegator_weight_day13: number | string;
  delegator_weight_day14: number | string;
  delegator_weight_day15: number | string;
  delegator_weight_day16: number | string;
  delegator_weight_day17: number | string;
  delegator_weight_day18: number | string;
  delegator_weight_day19: number | string;
  delegator_weight_day20: number | string;
  delegator_weight_day21: number | string;
  delegator_weight_day22: number | string;
  delegator_weight_day23: number | string;
  delegator_weight_day24: number | string;
  delegator_weight_day25: number | string;
  delegator_weight_day26: number | string;
  delegator_weight_day27: number | string;
  delegator_weight_day28: number | string;
  delegator_weight_day29: number | string;
  delegator_weight_day30: number | string;
  validator_count_day1: number | string;
  validator_count_day2: number | string;
  validator_count_day3: number | string;
  validator_count_day4: number | string;
  validator_count_day5: number | string;
  validator_count_day6: number | string;
  validator_count_day7: number | string;
  validator_count_day8: number | string;
  validator_count_day9: number | string;
  validator_count_day10: number | string;
  validator_count_day11: number | string;
  validator_count_day12: number | string;
  validator_count_day13: number | string;
  validator_count_day14: number | string;
  validator_count_day15: number | string;
  validator_count_day16: number | string;
  validator_count_day17: number | string;
  validator_count_day18: number | string;
  validator_count_day19: number | string;
  validator_count_day20: number | string;
  validator_count_day21: number | string;
  validator_count_day22: number | string;
  validator_count_day23: number | string;
  validator_count_day24: number | string;
  validator_count_day25: number | string;
  validator_count_day26: number | string;
  validator_count_day27: number | string;
  validator_count_day28: number | string;
  validator_count_day29: number | string;
  validator_count_day30: number | string;
  validator_weight_day1: number | string;
  validator_weight_day2: number | string;
  validator_weight_day3: number | string;
  validator_weight_day4: number | string;
  validator_weight_day5: number | string;
  validator_weight_day6: number | string;
  validator_weight_day7: number | string;
  validator_weight_day8: number | string;
  validator_weight_day9: number | string;
  validator_weight_day10: number | string;
  validator_weight_day11: number | string;
  validator_weight_day12: number | string;
  validator_weight_day13: number | string;
  validator_weight_day14: number | string;
  validator_weight_day15: number | string;
  validator_weight_day16: number | string;
  validator_weight_day17: number | string;
  validator_weight_day18: number | string;
  validator_weight_day19: number | string;
  validator_weight_day20: number | string;
  validator_weight_day21: number | string;
  validator_weight_day22: number | string;
  validator_weight_day23: number | string;
  validator_weight_day24: number | string;
  validator_weight_day25: number | string;
  validator_weight_day26: number | string;
  validator_weight_day27: number | string;
  validator_weight_day28: number | string;
  validator_weight_day29: number | string;
  validator_weight_day30: number | string;
}

let cachedData: { data: PrimaryNetworkMetrics; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;
async function getDelegatorCount30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/delegatorCount?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getDelegatorWeight30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/delegatorWeight?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getValidatorCount30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getValidatorWeight30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorWeight?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function fetchValidatorVersions() {
  if (!GLACIER_API_KEY) return {};

  try {
    const response = await fetch('https://glacier-api.avax.network/v1/networks/mainnet', {
      headers: {
        'x-glacier-api-key': GLACIER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Glacier API failed with status: ${response.status}`);
      return {};
    }

    const data = await response.json();
    console.log('Glacier API response received:', {
      validatorCount: data?.validatorDetails?.validatorCount,
      totalAmountStaked: data?.validatorDetails?.totalAmountStaked,
      versionsCount: data?.validatorDetails?.stakingDistributionByVersion?.length
    });

    if (!data?.validatorDetails?.stakingDistributionByVersion) {
      console.error('No stakingDistributionByVersion found in response');
      return {};
    }

    const versionData: { [key: string]: { validatorCount: number; amountStaked: string } } = {};
    data.validatorDetails.stakingDistributionByVersion.forEach((item: any) => {
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

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
        }
      });
    }
    const startTime = Date.now();

    const [
      delegatorCounts,
      delegatorWeights,
      validatorCounts,
      validatorWeights,
      validatorVersions
    ] = await Promise.all([
      getDelegatorCount30Days(),
      getDelegatorWeight30Days(),
      getValidatorCount30Days(),
      getValidatorWeight30Days(),
      fetchValidatorVersions()
    ]);

    const validatorVersionsJson = JSON.stringify(validatorVersions);
    console.log('Validator versions JSON:', validatorVersionsJson);

    const metrics: PrimaryNetworkMetrics = {
      validator_versions: validatorVersionsJson,
    } as PrimaryNetworkMetrics;

    for (let i = 1; i <= 30; i++) {
      (metrics as any)[`delegator_count_day${i}`] = delegatorCounts[i - 1] === "N/A" ? "N/A" : delegatorCounts[i - 1];
    }

    for (let i = 1; i <= 30; i++) {
      (metrics as any)[`delegator_weight_day${i}`] = delegatorWeights[i - 1] === "N/A" ? "N/A" : delegatorWeights[i - 1];
    }

    for (let i = 1; i <= 30; i++) {
      (metrics as any)[`validator_count_day${i}`] = validatorCounts[i - 1] === "N/A" ? "N/A" : validatorCounts[i - 1];
    }

    for (let i = 1; i <= 30; i++) {
      (metrics as any)[`validator_weight_day${i}`] = validatorWeights[i - 1] === "N/A" ? "N/A" : validatorWeights[i - 1];
    }

    cachedData = {
      data: metrics,
      timestamp: Date.now()
    };

    const fetchTime = Date.now() - startTime;

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Data-Source': 'fresh-exact-script',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Validator-Count-Day1': validatorCounts[0]?.toString() || 'N/A',
        'X-Delegator-Count-Day1': delegatorCounts[0]?.toString() || 'N/A',
        'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
      }
    });

  } catch (error) {
    console.error('Error in Primary Network API:', error);
    
    if (cachedData) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
          'X-Data-Source': 'cache-fallback',
          'X-Cache-Timestamp': new Date(cachedData.timestamp).toISOString(),
          'X-Error': 'true',
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch Primary Network metrics' },
      { status: 500 }
    );
  }
}