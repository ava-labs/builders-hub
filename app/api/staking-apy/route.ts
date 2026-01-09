import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';
const REQUEST_TIMEOUT_MS = 15000;

// Avalanche Network Constants
const GENESIS_SUPPLY = 360_000_000; // 360M AVAX at genesis
const MAX_SUPPLY = 720_000_000; // 720M AVAX max supply
const MIN_CONSUMPTION_RATE = 0.10; // 10% for min staking duration (2 weeks)
const MAX_CONSUMPTION_RATE = 0.12; // 12% for max staking duration (1 year)

// Official Avalanche supply API
const AVAX_SUPPLY_API_URL = 'https://data-api.avax.network/v1/avax/supply';

// Metabase endpoint for historical emissions data
const PRIMARY_NETWORK_FEES_URL = 'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/38ea69a5-e373-4258-9db6-8425fcba3a1a/dashcard/9955/card/13502?parameters=%5B%5D';

interface TimeSeriesDataPoint {
  timestamp: number;
  cumulativeRewards: number;
  cumulativeBurn: number;
  date: string;
}

interface APYDataPoint {
  date: string;
  timestamp: number;
  supply: number;
  maxAPY: number; // APY for 1-year staking
  minAPY: number; // APY for 2-week staking
}

interface OfficialSupplyData {
  totalSupply: string;
  circulatingSupply: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  totalStaked: string;
  totalLocked: string;
  totalRewards: string;
  lastUpdated: string;
  genesisUnlock: string;
  l1ValidatorFees: string;
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

async function fetchOfficialSupplyData(): Promise<OfficialSupplyData | null> {
  try {
    const response = await fetchWithTimeout(AVAX_SUPPLY_API_URL, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`[fetchOfficialSupplyData] Failed to fetch: ${response.status}`);
      return null;
    }

    const data: OfficialSupplyData = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn('[fetchOfficialSupplyData] Error:', error);
    }
    return null;
  }
}

async function fetchHistoricalEmissions(): Promise<TimeSeriesDataPoint[]> {
  try {
    const response = await fetchWithTimeout(PRIMARY_NETWORK_FEES_URL, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`[fetchHistoricalEmissions] Failed to fetch: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data?.data?.rows || !Array.isArray(data.data.rows)) {
      console.warn('[fetchHistoricalEmissions] Invalid data format');
      return [];
    }

    // Column mapping from the API:
    // idx[0] = date
    // idx[2] = cumulative burn
    // idx[3] = net cumulative emissions (rewards - burns)
    const result: TimeSeriesDataPoint[] = [];

    data.data.rows.forEach((row: any[]) => {
      const dateStr = row[0];
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      const date = dateStr.split('T')[0];
      const cumulativeBurn = row[2] || 0;
      const netCumulativeEmissions = row[3] || 0;
      
      // Cumulative rewards = net emissions + burns (to get gross rewards minted)
      const cumulativeRewards = netCumulativeEmissions + cumulativeBurn;

      result.push({ timestamp, cumulativeRewards, cumulativeBurn, date });
    });

    // Sort by timestamp ascending (oldest first) for chart display
    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn('[fetchHistoricalEmissions] Error:', error);
    }
    return [];
  }
}

function calculateAPY(supply: number, totalBurned: number, consumptionRate: number): number {
  // APY formula with burns-adjusted max supply:
  // Burned tokens reduce the effective max supply since they can never be re-minted
  // APY = ((AdjustedMaxSupply - Supply) / Supply) × ConsumptionRate × 100
  // where AdjustedMaxSupply = MaxSupply - TotalBurned
  if (supply <= 0) return 0;
  const adjustedMaxSupply = MAX_SUPPLY - totalBurned;
  const remainingToEmit = adjustedMaxSupply - supply;
  const apy = (remainingToEmit / supply) * consumptionRate * 100;
  return Math.max(0, apy); // Ensure non-negative
}

export async function GET() {
  try {
    // Fetch both official current data and historical data in parallel
    const [officialData, historicalData] = await Promise.all([
      fetchOfficialSupplyData(),
      fetchHistoricalEmissions()
    ]);

    if (!officialData && historicalData.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch supply data' },
        { status: 500 }
      );
    }

    // Calculate current APY from official API data (most accurate)
    let currentSupply = GENESIS_SUPPLY;
    let currentBurned = 0;
    let currentMaxAPY = 0;
    let currentMinAPY = 0;

    if (officialData) {
      const totalRewards = parseFloat(officialData.totalRewards) || 0;
      const totalPBurned = parseFloat(officialData.totalPBurned) || 0;
      const totalCBurned = parseFloat(officialData.totalCBurned) || 0;
      const totalXBurned = parseFloat(officialData.totalXBurned) || 0;
      
      currentBurned = totalPBurned + totalCBurned + totalXBurned;
      currentSupply = GENESIS_SUPPLY + totalRewards;
      currentMaxAPY = calculateAPY(currentSupply, currentBurned, MAX_CONSUMPTION_RATE);
      currentMinAPY = calculateAPY(currentSupply, currentBurned, MIN_CONSUMPTION_RATE);
    }

    // Calculate historical APY data points
    const apyData: APYDataPoint[] = historicalData.map((point) => {
      const supply = GENESIS_SUPPLY + point.cumulativeRewards;
      const burned = point.cumulativeBurn;
      
      return {
        date: point.date,
        timestamp: point.timestamp,
        supply,
        maxAPY: calculateAPY(supply, burned, MAX_CONSUMPTION_RATE),
        minAPY: calculateAPY(supply, burned, MIN_CONSUMPTION_RATE),
      };
    });

    // If we have official data, update the most recent historical point or add it
    if (officialData && apyData.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const lastPoint = apyData[apyData.length - 1];
      
      // Update or add today's data point with official API values
      if (lastPoint.date === today) {
        lastPoint.supply = currentSupply;
        lastPoint.maxAPY = currentMaxAPY;
        lastPoint.minAPY = currentMinAPY;
      } else {
        apyData.push({
          date: today,
          timestamp: Math.floor(Date.now() / 1000),
          supply: currentSupply,
          maxAPY: currentMaxAPY,
          minAPY: currentMinAPY,
        });
      }
    }

    // Fallback to historical data if official API failed
    if (!officialData && apyData.length > 0) {
      const latestHistorical = apyData[apyData.length - 1];
      currentSupply = latestHistorical.supply;
      currentMaxAPY = latestHistorical.maxAPY;
      currentMinAPY = latestHistorical.minAPY;
    }

    const headers: Record<string, string> = {
      'Cache-Control': CACHE_CONTROL_HEADER,
    };

    return NextResponse.json({
      data: apyData,
      current: {
        supply: currentSupply,
        totalBurned: currentBurned,
        maxAPY: currentMaxAPY,
        minAPY: currentMinAPY,
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
