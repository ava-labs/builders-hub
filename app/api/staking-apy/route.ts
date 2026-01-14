import { NextResponse } from 'next/server';
import { createPChainClient } from '@avalanche-sdk/client';
import { avalanche } from '@avalanche-sdk/client/chains';

export const dynamic = 'force-dynamic';

const CONFIG = {
  cache: {
    maxAge: 14400, // 4 hours
    staleWhileRevalidate: 86400, // 24 hours
  },
  timeout: 15000, // 15 seconds
  
  // Network Constants for Primary Network Mainnet
  network: {
    genesisSupply: 360_000_000, // 360M AVAX unlocked at genesis
    maxSupply: 720_000_000, // 720M AVAX maximum supply cap
    minConsumptionRate: 0.10, // 10% for minimum staking duration
    maxConsumptionRate: 0.12, // 12% for maximum staking duration
    mintingPeriodDays: 365, // 1 year
    minStakingDays: 14, // 2 weeks
    maxStakingDays: 365, // 1 year
  },

  endpoints: {
    dataApi: 'https://data-api.avax.network/v1/avax/supply',
    metabase: 'https://ava-labs-inc.metabaseapp.com/api/public/dashboard/38ea69a5-e373-4258-9db6-8425fcba3a1a/dashcard/9955/card/13502?parameters=%5B%5D',
  },
} as const;

const pChainClient = createPChainClient({
  chain: avalanche,
  transport: { type: 'http' },
});

interface APYDataPoint {
  date: string;
  timestamp: number;
  supply: number; // Supply used for APY calculation
  maxAPY: number; // APY for 1-year staking (max rate)
  minAPY: number; // APY for 2-week staking (min rate)
}

interface CurrentData {
  supply: number;
  totalBurned: number;
  maxAPY: number;
  minAPY: number;
}

interface MetabaseRow {
  date: string;
  cumulativeEmissions: number;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = CONFIG.timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculate Effective Consumption Rate based on staking duration.
 * The rate interpolates linearly between min and max based on how long you stake:
 * - 2 weeks (min): ~10.08% effective rate
 * - 1 year (max): 12.00% effective rate
 */
function getEffectiveConsumptionRate(stakingDays: number): number {
  const { minConsumptionRate, maxConsumptionRate, mintingPeriodDays } = CONFIG.network;
  const t = Math.min(1, Math.max(0, stakingDays / mintingPeriodDays));
  return minConsumptionRate * (1 - t) + maxConsumptionRate * t;
}

/**
 * Calculate staking APY using the official Avalanche rewards formula.
 * Reward = (MaxSupply - Supply) × (Stake/Supply) × (StakingPeriod/MintingPeriod) × ECR
 * APY = (MaxSupply - Supply) / Supply × ECR × 100
 */
function calculateAPY(supply: number, stakingDays: number): number {
  if (supply <= 0 || supply >= CONFIG.network.maxSupply) return 0;
  
  const remainingToMint = CONFIG.network.maxSupply - supply;
  const effectiveRate = getEffectiveConsumptionRate(stakingDays);
  const apy = (remainingToMint / supply) * effectiveRate * 100;
  
  return Math.max(0, Number(apy.toFixed(2)));
}

async function fetchPChainSupply(): Promise<number | null> {
  try {
    // Get Primary Network supply (no subnetId needed for default)
    const result = await pChainClient.getCurrentSupply({});
    // Supply is returned as bigint in nanoAVAX, convert to AVAX
    return Number(result.supply) / 1_000_000_000;
  } catch (error) {
    console.error('[fetchPChainSupply] SDK error:', error);
    return null;
  }
}

async function fetchDataApiDetails(): Promise<{ totalBurned: number } | null> {
  try {
    const response = await fetchWithTimeout(CONFIG.endpoints.dataApi, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;
    const data = await response.json();
    const totalBurned = (parseFloat(data.totalPBurned) || 0) + (parseFloat(data.totalCBurned) || 0) + (parseFloat(data.totalXBurned) || 0);
    return { totalBurned };
  } catch {
    return null;
  }
}

async function fetchHistoricalData(): Promise<MetabaseRow[]> {
  try {
    const response = await fetchWithTimeout(CONFIG.endpoints.metabase, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data?.data?.rows || !Array.isArray(data.data.rows)) return [];
    const rows: MetabaseRow[] = [];
    for (const row of data.data.rows) {
      const dateStr = row[0];
      const emissions = row[1];    
      if (!dateStr || typeof emissions !== 'number' || emissions <= 0) continue;

      rows.push({
        date: dateStr.split('T')[0],
        cumulativeEmissions: emissions,
      });
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [pChainSupply, dataApiDetails, historicalData] = await Promise.all([
      fetchPChainSupply(),
      fetchDataApiDetails(),
      fetchHistoricalData(),
    ]);

    if (!pChainSupply && historicalData.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch supply data from all sources' },
        { status: 503 }
      );
    }

    const currentSupply = pChainSupply ?? CONFIG.network.genesisSupply;
    const current: CurrentData = {
      supply: currentSupply,
      totalBurned: dataApiDetails?.totalBurned ?? 0,
      maxAPY: calculateAPY(currentSupply, CONFIG.network.maxStakingDays),
      minAPY: calculateAPY(currentSupply, CONFIG.network.minStakingDays),
    };

    let apyHistory: APYDataPoint[] = [];

    if (historicalData.length > 0 && pChainSupply) {
      const latestMetabase = historicalData[historicalData.length - 1];
      const metabaseLatestSupply = CONFIG.network.genesisSupply + latestMetabase.cumulativeEmissions;
      const alignmentOffset = pChainSupply - metabaseLatestSupply;
      apyHistory = historicalData.map((row) => {
        const supply = CONFIG.network.genesisSupply + row.cumulativeEmissions + alignmentOffset;
        return {
          date: row.date,
          timestamp: Math.floor(new Date(row.date).getTime() / 1000),
          supply,
          maxAPY: calculateAPY(supply, CONFIG.network.maxStakingDays),
          minAPY: calculateAPY(supply, CONFIG.network.minStakingDays),
        };
      });

      const today = new Date().toISOString().split('T')[0];
      const lastPoint = apyHistory[apyHistory.length - 1];

      if (lastPoint.date === today) {
        lastPoint.supply = currentSupply;
        lastPoint.maxAPY = current.maxAPY;
        lastPoint.minAPY = current.minAPY;
      } else {
        apyHistory.push({
          date: today,
          timestamp: Math.floor(Date.now() / 1000),
          supply: currentSupply,
          maxAPY: current.maxAPY,
          minAPY: current.minAPY,
        });
      }
    }

    const response = {
      data: apyHistory,
      current,
      constants: {
        genesisSupply: CONFIG.network.genesisSupply,
        maxSupply: CONFIG.network.maxSupply,
        minConsumptionRate: CONFIG.network.minConsumptionRate,
        maxConsumptionRate: CONFIG.network.maxConsumptionRate,
        minStakingDuration: '2 weeks',
        maxStakingDuration: '1 year',
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, max-age=${CONFIG.cache.maxAge}, s-maxage=${CONFIG.cache.maxAge}, stale-while-revalidate=${CONFIG.cache.staleWhileRevalidate}`,
      },
    });
  } catch (error) {
    console.error('[GET /api/staking-apy] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
