import { NextResponse } from 'next/server';
import { EXPLORER_API_BASE } from '@/lib/pchain-explorer';

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

} as const;

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

interface EmissionsRow {
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
    // Primary Network current supply from our own P-chain read API (served from
    // ClickHouse) — replaces the @avalanche-sdk/client RPC call. currentSupply
    // is nAVAX; the APY math works in AVAX.
    const response = await fetchWithTimeout(`${EXPLORER_API_BASE}/api/mainnet/stats`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.currentSupply ? Number(data.currentSupply) / 1_000_000_000 : null;
  } catch (error) {
    console.error('[fetchPChainSupply] error:', error);
    return null;
  }
}

// Historical cumulative emissions from our metrics-api (cumulative staking
// rewards reconstructed from reward UTXOs). Any constant accounting offset in
// the series is absorbed below by alignmentOffset (the curve is shifted so its
// latest point equals the real on-chain supply). Full history from 2020-10.
async function fetchHistoricalData(): Promise<EmissionsRow[]> {
  try {
    const response = await fetchWithTimeout(
      `${EXPLORER_API_BASE}/v2/networks/mainnet/metrics/cumulativeStakingRewards`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.results)) return [];
    const rows: EmissionsRow[] = [];
    for (const r of data.results as { value: number; timestamp: number }[]) {
      if (typeof r.value !== 'number' || r.value <= 0) continue;
      rows.push({
        date: new Date(r.timestamp * 1000).toISOString().split('T')[0],
        cumulativeEmissions: r.value,
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
    const [pChainSupply, historicalData] = await Promise.all([
      fetchPChainSupply(),
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
      // Total-burned came from Glacier (data-api /v1/avax/supply), now removed.
      // Not currently served by our own data; 0 until we surface it (display-only,
      // not used in the APY calculation).
      totalBurned: 0,
      maxAPY: calculateAPY(currentSupply, CONFIG.network.maxStakingDays),
      minAPY: calculateAPY(currentSupply, CONFIG.network.minStakingDays),
    };

    let apyHistory: APYDataPoint[] = [];

    if (historicalData.length > 0 && pChainSupply) {
      const latestRow = historicalData[historicalData.length - 1];
      const seriesLatestSupply = CONFIG.network.genesisSupply + latestRow.cumulativeEmissions;
      const alignmentOffset = pChainSupply - seriesLatestSupply;
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
