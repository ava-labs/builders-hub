import { NextResponse } from 'next/server';
import {
  HELICON_ACTIVATION,
  MIN_STAKING_DAYS_PRE,
  heliconActive,
  minConsumptionRateAt,
  minStakingDaysAt,
} from '@/constants/helicon';
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
    maxConsumptionRate: 0.12, // 12% for maximum staking duration
    mintingPeriodDays: 365, // 1 year
    maxStakingDays: 365, // 1 year
    // The Helicon-sensitive floor and minimum duration live in
    // constants/helicon.ts, since this route plots a multi-year series and each
    // point must use the parameters in effect on its own date.
  },

} as const;

interface APYDataPoint {
  date: string;
  timestamp: number;
  supply: number; // Supply used for APY calculation
  maxAPY: number; // APY for 1-year staking (max rate)
  minAPY: number; // APY for the minimum duration in effect (2 weeks, 2 days after Helicon)
  twoWeekAPY: number; // APY for 2-week staking
  twoDayAPY: number | null; // APY for 2-day staking, null before Helicon allowed it
}

interface CurrentData {
  supply: number;
  totalBurned: number;
  maxAPY: number;
  minAPY: number;
  twoWeekAPY: number;
  twoDayAPY: number | null;
}

type TermRates = Pick<APYDataPoint, 'maxAPY' | 'minAPY' | 'twoWeekAPY' | 'twoDayAPY'>;

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
 * The rate interpolates linearly between the floor in effect at `at` and max:
 * - minimum duration: ~= the floor
 * - 1 year (max): 12.00% effective rate
 */
function getEffectiveConsumptionRate(stakingDays: number, at: number): number {
  const { maxConsumptionRate, mintingPeriodDays } = CONFIG.network;
  const t = Math.min(1, Math.max(0, stakingDays / mintingPeriodDays));
  return minConsumptionRateAt(at) * (1 - t) + maxConsumptionRate * t;
}

/**
 * Calculate staking APY using the official Avalanche rewards formula.
 * Reward = (MaxSupply - Supply) × (Stake/Supply) × (StakingPeriod/MintingPeriod) × ECR
 * APY = (MaxSupply - Supply) / Supply × ECR × 100
 */
function calculateAPY(supply: number, stakingDays: number, at: number): number {
  if (supply <= 0 || supply >= CONFIG.network.maxSupply) return 0;

  const remainingToMint = CONFIG.network.maxSupply - supply;
  const effectiveRate = getEffectiveConsumptionRate(stakingDays, at);
  const apy = (remainingToMint / supply) * effectiveRate * 100;
  
  return Math.max(0, Number(apy.toFixed(2)));
}

function termRates(supply: number, at: number): TermRates {
  return {
    maxAPY: calculateAPY(supply, CONFIG.network.maxStakingDays, at),
    minAPY: calculateAPY(supply, minStakingDaysAt(at), at),
    twoWeekAPY: calculateAPY(supply, MIN_STAKING_DAYS_PRE, at),
    twoDayAPY: heliconActive(at) ? calculateAPY(supply, 2, at) : null,
  };
}

/** The rates at the Helicon activation instant, the supply interpolated between the days around it. */
function heliconPoint(history: APYDataPoint[]): APYDataPoint | null {
  const at = HELICON_ACTIVATION.mainnet;
  const i = history.findIndex((p) => p.timestamp * 1000 > at);
  if (i <= 0) return null;
  const a = history[i - 1];
  const b = history[i];
  const t = (at / 1000 - a.timestamp) / (b.timestamp - a.timestamp);
  const supply = a.supply + (b.supply - a.supply) * t;
  return {
    date: new Date(at).toISOString().split('T')[0],
    timestamp: Math.floor(at / 1000),
    supply,
    ...termRates(supply, at),
  };
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
    const nowMs = Date.now();
    const current: CurrentData = {
      supply: currentSupply,
      // Total-burned came from Glacier (data-api /v1/avax/supply), now removed.
      // Not currently served by our own data; 0 until we surface it (display-only,
      // not used in the APY calculation).
      totalBurned: 0,
      ...termRates(currentSupply, nowMs),
    };

    let apyHistory: APYDataPoint[] = [];

    if (historicalData.length > 0 && pChainSupply) {
      const latestRow = historicalData[historicalData.length - 1];
      const seriesLatestSupply = CONFIG.network.genesisSupply + latestRow.cumulativeEmissions;
      const alignmentOffset = pChainSupply - seriesLatestSupply;
      apyHistory = historicalData.map((row) => {
        const supply = CONFIG.network.genesisSupply + row.cumulativeEmissions + alignmentOffset;
        // Each point is priced with the parameters in effect on its own date.
        const at = new Date(row.date).getTime();
        return {
          date: row.date,
          timestamp: Math.floor(at / 1000),
          supply,
          ...termRates(supply, at),
        };
      });

      const today = new Date().toISOString().split('T')[0];
      const lastPoint = apyHistory[apyHistory.length - 1];

      if (lastPoint.date === today) {
        Object.assign(lastPoint, termRates(currentSupply, nowMs), { supply: currentSupply });
      } else {
        apyHistory.push({
          date: today,
          timestamp: Math.floor(Date.now() / 1000),
          supply: currentSupply,
          ...termRates(currentSupply, nowMs),
        });
      }
    }

    const response = {
      data: apyHistory,
      current,
      // A sample at the upgrade instant itself (not in `data`), where the 2-day term begins.
      helicon: heliconPoint(apyHistory),
      constants: {
        genesisSupply: CONFIG.network.genesisSupply,
        maxSupply: CONFIG.network.maxSupply,
        // What applies right now, not the pre-Helicon baseline.
        minConsumptionRate: minConsumptionRateAt(nowMs),
        maxConsumptionRate: CONFIG.network.maxConsumptionRate,
        minStakingDuration: heliconActive(nowMs) ? '48 hours' : '2 weeks',
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
