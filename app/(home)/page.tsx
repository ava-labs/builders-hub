import type { Metadata } from 'next';
import StoryHome from '@/components/landing-v2/StoryHome';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://build.avax.network';

const HOME_DESCRIPTION =
  'Sovereign L1 networks with sub-second finality, native interoperability, and protocol-level privacy and compliance controls.';

export const metadata: Metadata = {
  title: 'Avalanche Builder Hub',
  description: HOME_DESCRIPTION,
  openGraph: {
    title: 'Avalanche Builder Hub',
    description: HOME_DESCRIPTION,
    url: BASE_URL,
    images: [{ url: '/api/og/home', width: 1280, height: 720, alt: 'Launch a network on Avalanche' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Avalanche Builder Hub',
    description: HOME_DESCRIPTION,
    images: ['/api/og/home'],
  },
};

async function getGlobeData() {
  try {
    const [metricsRes, icmRes] = await Promise.all([
      fetch(`${BASE_URL}/api/overview-stats?timeRange=month`, {
        next: { revalidate: 3600 },
      }),
      fetch(`${BASE_URL}/api/icm-flow?days=30`, {
        next: { revalidate: 3600 },
      }),
    ]);

    const [metrics, icmData] = await Promise.all([
      metricsRes.ok ? metricsRes.json() : null,
      icmRes.ok ? icmRes.json() : null,
    ]);

    return {
      metrics,
      icmFlows: icmData?.flows || [],
    };
  } catch (error) {
    console.error('Failed to fetch globe data:', error);
    return { metrics: null, icmFlows: [] };
  }
}

const PRIMARY_NETWORK_ID = '11111111111111111111111111111111LpoYY';

// P-Chain-derived figures: L1 count (subnets flagged isL1 in the registry —
// the Glacier activity aggregate undercounts at ~27) and the AVAX staked on
// the primary network (economic security, the number institutions evaluate).
async function getPChainStats(): Promise<{
  l1Count: number | null;
  primaryStakeAvax: number | null;
}> {
  try {
    const res = await fetch(`${BASE_URL}/api/validator-stats?network=mainnet`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { l1Count: null, primaryStakeAvax: null };
    const subnets: { id: string; isL1?: boolean; totalStakeString?: string }[] = await res.json();
    const count = subnets.filter((s) => s.isL1).length;
    const primary = subnets.find((s) => s.id === PRIMARY_NETWORK_ID);
    const stake = primary?.totalStakeString
      ? Math.round(Number(BigInt(primary.totalStakeString) / 1_000_000_000n))
      : null;
    return { l1Count: count > 0 ? count : null, primaryStakeAvax: stake };
  } catch (error) {
    console.error('Failed to fetch P-Chain stats:', error);
    return { l1Count: null, primaryStakeAvax: null };
  }
}

// Live AVAX/USD for the stake figure — short revalidate keeps it honest,
// and a failed fetch degrades to showing AVAX only (never a stale price).
async function getAvaxUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd',
      { headers: { accept: 'application/json' }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.['avalanche-2']?.usd;
    return typeof price === 'number' && price > 0 ? price : null;
  } catch (error) {
    console.error('Failed to fetch AVAX price:', error);
    return null;
  }
}

// Circulating supply for the %-staked figure. Slow-moving, long revalidate.
async function getCirculatingSupply(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/avax-supply`, { next: { revalidate: 14400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const supply = Number(data?.circulatingSupply);
    return Number.isFinite(supply) && supply > 0 ? supply : null;
  } catch (error) {
    console.error('Failed to fetch AVAX supply:', error);
    return null;
  }
}

// Kite AI's mainnet L1 is not indexed by the shared Metrics API; the
// chain-stats route proxies its dedicated metrics source. We sum the daily
// series so the showcase row matches the table's 30-day window.
const KITEAI_CHAIN_ID = '3USaEfTcoUhHxpKXvpAG916UKCUEyjrtkg2hBArBG3JyDP7my';

async function getKiteTxCount(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/chain-stats/${KITEAI_CHAIN_ID}?timeRange=30d`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const points: { value?: unknown }[] = data?.txCount?.data ?? [];
    const total = points.reduce(
      (sum, p) => sum + (typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : 0),
      0,
    );
    return total > 0 ? total : null;
  } catch (error) {
    console.error('Failed to fetch Kite AI stats:', error);
    return null;
  }
}

// DeFiLlama: capital metrics institutions screen for — TVL (committed
// capital), stablecoin float (settlement liquidity), DEX volume (depth).
async function getDefiStats(): Promise<{
  tvlUsd: number | null;
  stablesUsd: number | null;
  dexVolume30dUsd: number | null;
}> {
  const opts = { next: { revalidate: 3600 } };
  const [tvl, stables, dex] = await Promise.all([
    fetch('https://api.llama.fi/v2/chains', opts)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => rows?.find((c: any) => c.name === 'Avalanche')?.tvl ?? null)
      .catch(() => null),
    fetch('https://stablecoins.llama.fi/stablecoinchains', opts)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        // sum every peg (USD, EUR, JPY, SGD, ...) — values are USD-denominated
        const pegs = rows?.find((c: any) => c.name === 'Avalanche')?.totalCirculatingUSD;
        if (!pegs) return null;
        return Object.values(pegs).reduce(
          (sum: number, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
          0,
        );
      })
      .catch(() => null),
    fetch(
      'https://api.llama.fi/overview/dexs/avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
      opts,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.total30d ?? null)
      .catch(() => null),
  ]);
  // full float precision — the ledger displays money to the cent
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return { tvlUsd: num(tvl), stablesUsd: num(stables), dexVolume30dUsd: num(dex) };
}

export default async function HomePage(): Promise<React.ReactElement> {
  const [globeData, pchain, avaxUsd, circulatingSupply, defi, kiteTxCount] = await Promise.all([
    getGlobeData(),
    getPChainStats(),
    getAvaxUsdPrice(),
    getCirculatingSupply(),
    getDefiStats(),
    getKiteTxCount(),
  ]);
  return (
    <StoryHome
      globeData={globeData}
      kiteTxCount={kiteTxCount}
      l1Count={pchain.l1Count}
      primaryStakeAvax={pchain.primaryStakeAvax}
      primaryStakeUsd={
        pchain.primaryStakeAvax !== null && avaxUsd !== null
          ? pchain.primaryStakeAvax * avaxUsd
          : null
      }
      avaxUsdPrice={avaxUsd}
      defi={defi}
      supplyStakedPct={
        pchain.primaryStakeAvax !== null && circulatingSupply !== null
          ? (pchain.primaryStakeAvax / circulatingSupply) * 100
          : null
      }
    />
  );
}
