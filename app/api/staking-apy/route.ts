import { NextResponse } from 'next/server';
import { createPChainClient } from '@avalanche-sdk/client';
import { avalanche } from '@avalanche-sdk/client/chains';

export const dynamic = 'force-dynamic';

const DAY_SECONDS = 86_400;

// ACP-285 (Helicon upgrade): the MinConsumptionRate floor is reduced from 10% to
// 7.5% via a linear ramp that is continuous in a stake's *start time*. A stake that
// starts mid-ramp locks in the interpolated floor for its whole duration, so the
// effective floor on any given date is a function of that date.
// See: https://build.avax.network/docs/acps/285-reduce-minimum-consumption-rate
//
// The activation date is intentionally configurable: it defaults to a placeholder
// and can be overridden via the HELICON_ACTIVATION_DATE env var (ISO 8601). Set
// HELICON_ENABLED=false to hide the transition entirely.
const HELICON_ACTIVATION_ISO = process.env.HELICON_ACTIVATION_DATE || '2026-05-01T00:00:00Z';
const HELICON_ACTIVATION_TS = Math.floor(new Date(HELICON_ACTIVATION_ISO).getTime() / 1000);

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

  // ACP-285 Helicon transition: linear reduction of the MinConsumptionRate floor.
  helicon: {
    enabled: process.env.HELICON_ENABLED !== 'false',
    activationTimestamp: HELICON_ACTIVATION_TS, // when the ramp begins
    rampDurationDays: 30, // floor declines linearly over this window
    startMinConsumptionRate: 0.10, // current floor (ramp start)
    targetMinConsumptionRate: 0.075, // ACP-285 target floor (ramp end)
    projectionTailDays: 15, // show the settled floor briefly after the ramp ends
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
  minConsumptionRate: number; // effective floor rate for a stake started on this date
  projected: boolean; // true for forward-projected Helicon transition points
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
 * Resolve the MinConsumptionRate floor for a stake that starts at `timestamp`.
 *
 * ACP-285 (Helicon) ramps this floor linearly from 10% to 7.5% over 30 days,
 * continuous in the stake's start time:
 * - before activation: 10% (start floor)
 * - during the 30-day ramp: linearly interpolated (e.g. day 15 -> 8.75%)
 * - after the ramp: 7.5% (target floor)
 */
function getMinConsumptionRate(timestamp: number): number {
  const h = CONFIG.helicon;
  if (!h.enabled) return CONFIG.network.minConsumptionRate;

  const rampEnd = h.activationTimestamp + h.rampDurationDays * DAY_SECONDS;
  if (timestamp <= h.activationTimestamp) return h.startMinConsumptionRate;
  if (timestamp >= rampEnd) return h.targetMinConsumptionRate;

  const progress = (timestamp - h.activationTimestamp) / (rampEnd - h.activationTimestamp);
  return h.startMinConsumptionRate + (h.targetMinConsumptionRate - h.startMinConsumptionRate) * progress;
}

/**
 * Calculate Effective Consumption Rate based on staking duration.
 * The rate interpolates linearly between min and max based on how long you stake:
 * - 2 weeks (min): ~10.08% effective rate (pre-Helicon)
 * - 1 year (max): 12.00% effective rate
 *
 * `minConsumptionRate` is passed in so the date-dependent Helicon floor can flow through.
 */
function getEffectiveConsumptionRate(stakingDays: number, minConsumptionRate: number): number {
  const { maxConsumptionRate, mintingPeriodDays } = CONFIG.network;
  const t = Math.min(1, Math.max(0, stakingDays / mintingPeriodDays));
  return minConsumptionRate * (1 - t) + maxConsumptionRate * t;
}

/**
 * Calculate staking APY using the official Avalanche rewards formula.
 * Reward = (MaxSupply - Supply) × (Stake/Supply) × (StakingPeriod/MintingPeriod) × ECR
 * APY = (MaxSupply - Supply) / Supply × ECR × 100
 */
function calculateAPY(supply: number, stakingDays: number, minConsumptionRate: number): number {
  if (supply <= 0 || supply >= CONFIG.network.maxSupply) return 0;

  const remainingToMint = CONFIG.network.maxSupply - supply;
  const effectiveRate = getEffectiveConsumptionRate(stakingDays, minConsumptionRate);
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
    const nowTs = Math.floor(Date.now() / 1000);
    const currentMinRate = getMinConsumptionRate(nowTs);
    const current: CurrentData = {
      supply: currentSupply,
      totalBurned: dataApiDetails?.totalBurned ?? 0,
      maxAPY: calculateAPY(currentSupply, CONFIG.network.maxStakingDays, currentMinRate),
      minAPY: calculateAPY(currentSupply, CONFIG.network.minStakingDays, currentMinRate),
    };

    let apyHistory: APYDataPoint[] = [];

    if (historicalData.length > 0 && pChainSupply) {
      const latestMetabase = historicalData[historicalData.length - 1];
      const metabaseLatestSupply = CONFIG.network.genesisSupply + latestMetabase.cumulativeEmissions;
      const alignmentOffset = pChainSupply - metabaseLatestSupply;
      apyHistory = historicalData.map((row) => {
        const supply = CONFIG.network.genesisSupply + row.cumulativeEmissions + alignmentOffset;
        const timestamp = Math.floor(new Date(row.date).getTime() / 1000);
        const minRate = getMinConsumptionRate(timestamp);
        return {
          date: row.date,
          timestamp,
          supply,
          maxAPY: calculateAPY(supply, CONFIG.network.maxStakingDays, minRate),
          minAPY: calculateAPY(supply, CONFIG.network.minStakingDays, minRate),
          minConsumptionRate: minRate,
          projected: false,
        };
      });

      const today = new Date().toISOString().split('T')[0];
      const lastPoint = apyHistory[apyHistory.length - 1];

      if (lastPoint.date === today) {
        lastPoint.supply = currentSupply;
        lastPoint.maxAPY = current.maxAPY;
        lastPoint.minAPY = current.minAPY;
        lastPoint.minConsumptionRate = currentMinRate;
      } else {
        apyHistory.push({
          date: today,
          timestamp: nowTs,
          supply: currentSupply,
          maxAPY: current.maxAPY,
          minAPY: current.minAPY,
          minConsumptionRate: currentMinRate,
          projected: false,
        });
      }

      // Forward-project the Helicon transition. The floor (and therefore the min-APY
      // line) declines over the 30-day ramp; we hold supply ~constant across this short
      // window so the chart isolates the consumption-rate effect. Points are flagged
      // `projected` so the UI can render them distinctly (dashed) from real history.
      const h = CONFIG.helicon;
      if (h.enabled) {
        const rampEnd = h.activationTimestamp + h.rampDurationDays * DAY_SECONDS;
        const projectionEnd = rampEnd + h.projectionTailDays * DAY_SECONDS;
        const lastHistorical = apyHistory[apyHistory.length - 1];

        // Step daily from the day after the last real point through the projection window.
        for (let ts = lastHistorical.timestamp + DAY_SECONDS; ts <= projectionEnd; ts += DAY_SECONDS) {
          const minRate = getMinConsumptionRate(ts);
          apyHistory.push({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            timestamp: ts,
            supply: currentSupply,
            maxAPY: calculateAPY(currentSupply, CONFIG.network.maxStakingDays, minRate),
            minAPY: calculateAPY(currentSupply, CONFIG.network.minStakingDays, minRate),
            minConsumptionRate: minRate,
            projected: true,
          });
        }
      }
    }

    const h = CONFIG.helicon;
    const rampEndTs = h.activationTimestamp + h.rampDurationDays * DAY_SECONDS;
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
      // ACP-285 Helicon transition metadata for chart annotations.
      helicon: {
        enabled: h.enabled,
        activationDate: new Date(h.activationTimestamp * 1000).toISOString().split('T')[0],
        activationTimestamp: h.activationTimestamp,
        rampEndDate: new Date(rampEndTs * 1000).toISOString().split('T')[0],
        rampEndTimestamp: rampEndTs,
        rampDurationDays: h.rampDurationDays,
        startMinConsumptionRate: h.startMinConsumptionRate,
        targetMinConsumptionRate: h.targetMinConsumptionRate,
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
