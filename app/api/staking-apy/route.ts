import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 15000;

// Avalanche Network Constants
const GENESIS_SUPPLY = 360_000_000; // 360M AVAX at genesis
const MAX_SUPPLY = 720_000_000; // 720M AVAX max supply
const MIN_CONSUMPTION_RATE = 0.10; // 10% for min staking duration (2 weeks)
const MAX_CONSUMPTION_RATE = 0.12; // 12% for max staking duration (1 year)

// Metabase endpoint for Primary Network emissions data
const PRIMARY_NETWORK_FEES_URL = 'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/38ea69a5-e373-4258-9db6-8425fcba3a1a/dashcard/9955/card/13502?parameters=%5B%5D';

interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

interface APYDataPoint {
  date: string;
  timestamp: number;
  supply: number;
  maxAPY: number; // APY for 1-year staking
  minAPY: number; // APY for 2-week staking
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNetCumulativeEmissions(): Promise<TimeSeriesDataPoint[]> {
  try {
    const response = await fetchWithTimeout(PRIMARY_NETWORK_FEES_URL, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`[fetchNetCumulativeEmissions] Failed to fetch: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      console.warn('[fetchNetCumulativeEmissions] Invalid data format');
      return [];
    }

    // Column mapping from the API:
    // idx[0] = date
    // idx[3] = net cumulative emissions
    const result: TimeSeriesDataPoint[] = [];

    data.data.rows.forEach((row: any[]) => {
      const dateStr = row[0];
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      const date = dateStr.split('T')[0];
      const netCumulativeEmissions = row[3] || 0;

      result.push({ timestamp, value: netCumulativeEmissions, date });
    });

    // Sort by timestamp ascending (oldest first) for chart display
    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn('[fetchNetCumulativeEmissions] Error:', error);
    }
    return [];
  }
}

function calculateAPY(supply: number, consumptionRate: number): number {
  // APY = ((MaxSupply - Supply) / Supply) × ConsumptionRate × 100
  if (supply <= 0) return 0;
  const remainingToEmit = MAX_SUPPLY - supply;
  const apy = (remainingToEmit / supply) * consumptionRate * 100;
  return Math.max(0, apy); // Ensure non-negative
}

export async function GET() {
  try {
    const emissionsData = await fetchNetCumulativeEmissions();

    if (emissionsData.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch emissions data' },
        { status: 500 }
      );
    }

    // Calculate APY for each data point
    const apyData: APYDataPoint[] = emissionsData.map((point) => {
      // Historical supply = Genesis supply + net cumulative emissions
      const supply = GENESIS_SUPPLY + point.value;
      
      return {
        date: point.date,
        timestamp: point.timestamp,
        supply,
        maxAPY: calculateAPY(supply, MAX_CONSUMPTION_RATE),
        minAPY: calculateAPY(supply, MIN_CONSUMPTION_RATE),
      };
    });

    // Get current values (most recent)
    const currentData = apyData[apyData.length - 1];

    const headers: Record<string, string> = {
      'Cache-Control': CACHE_CONTROL_HEADER,
    };

    return NextResponse.json({
      data: apyData,
      current: {
        supply: currentData?.supply || GENESIS_SUPPLY,
        maxAPY: currentData?.maxAPY || 0,
        minAPY: currentData?.minAPY || 0,
      },
      constants: {
        genesisSupply: GENESIS_SUPPLY,
        maxSupply: MAX_SUPPLY,
        minConsumptionRate: MIN_CONSUMPTION_RATE,
        maxConsumptionRate: MAX_CONSUMPTION_RATE,
        minStakingDuration: '2 weeks',
        maxStakingDuration: '1 year',
      },
    }, { headers });
  } catch (error) {
    console.error('[GET /api/staking-apy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate staking APY' },
      { status: 500 }
    );
  }
}

