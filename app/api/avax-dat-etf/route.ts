import { NextResponse } from 'next/server';
import { DATS, ETFS, type DatEntry, type EtfEntry } from '@/constants/dat-etf';

// Live-overlay endpoint for the DATs & ETFs section on the AVAX token stats page.
// Probes free issuer/API sources for the fields we can keep reliably current:
//   - AVAX One treasury holdings via CoinGecko's public treasury API, with the
//     public Blueprint analytics page as a fallback
//   - VAVX AUM, NAV, and AVAX holdings via VanEck's public FundDatasetBlock JSON
//   - BAVA AUM, NAV, AVAX holdings, and staking percentages via Bitwise page data
// Everything else falls back to the static baseline in constants/dat-etf.ts.

export const revalidate = 1800; // 30 minutes

const REQUEST_TIMEOUT_MS = 6000;
const USER_AGENT = 'Mozilla/5.0 (compatible; BuildersHub/1.0)';

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = parseFloat(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCompactUsd(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^\$?\s*([\d,.]+)\s*([KMB])?$/i);
  if (!match) return parseNumber(value);

  const parsed = parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return null;

  const suffix = match[2]?.toUpperCase();
  if (suffix === 'B') return parsed * 1_000_000_000;
  if (suffix === 'M') return parsed * 1_000_000;
  if (suffix === 'K') return parsed * 1_000;
  return parsed;
}

function percentFromRatio(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function parseNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function fetchAvaxOneHoldingsFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/companies/public_treasury/avalanche-2',
      {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        next: { revalidate: 1800 },
      },
      4000,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const avaxOne = data?.companies?.find((company: { name?: string }) => company?.name === 'AVAX One');
    const holdings = parseNumber(avaxOne?.total_holdings);
    return holdings && holdings > 0 ? holdings : null;
  } catch {
    return null;
  }
}

async function fetchAvaxOneHoldingsFromBlueprint(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout('https://analytics-avaxone.theblueprint.xyz/', {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Primary pattern: "AVAX Held ... 13.8M AVAX"
    const labeled = html.match(/AVAX\s*Held[\s\S]*?([\d,.]+)\s*M\s*AVAX/i);
    if (labeled) {
      return parseFloat(labeled[1].replace(/,/g, '')) * 1_000_000;
    }
    // Fallback: any reasonable "Nx AVAX" figure in millions
    const loose = html.match(/([\d,.]+)\s*M\s*AVAX/i);
    if (loose) {
      const n = parseFloat(loose[1].replace(/,/g, ''));
      if (n > 1 && n < 100) return n * 1_000_000;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAvaxOneHoldings(): Promise<number | null> {
  return (await fetchAvaxOneHoldingsFromCoinGecko()) ?? (await fetchAvaxOneHoldingsFromBlueprint());
}

interface EtfLive {
  aum: number | null;
  avaxHoldings: number | null;
  navPerShare: number | null;
  marketPrice?: number | null;
  stakingPct?: number | null;
  stakingMax?: number | null;
  asOfDate?: string | null;
  source: 'vaneck' | 'yahoo' | 'bitwise';
}

async function fetchVavxFromVaneck(): Promise<EtfLive | null> {
  try {
    const res = await fetchWithTimeout(
      'https://www.vaneck.com/Main/FundDatasetBlock/Get/?blockId=353069&pageId=353872&ticker=VAVX',
      {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        next: { revalidate: 1800 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const avax = data?.HoldingsList?.[0]?.Holdings?.find((holding: { HoldingName?: string }) =>
      /avax/i.test(holding?.HoldingName ?? ''),
    );

    const aum = parseCompactUsd(data?.['Total Net Assets']);
    const avaxHoldings = parseNumber(avax?.Shares);
    const navPerShare = parseNumber(data?.NAV);
    const marketValue = parseNumber(avax?.MV);

    if (!aum && !avaxHoldings && !navPerShare) return null;

    return {
      aum: aum ?? marketValue,
      avaxHoldings,
      navPerShare,
      asOfDate: data?.HoldingsList?.[0]?.AsOfDate ?? avax?.DataDate ?? null,
      source: 'vaneck',
    };
  } catch {
    return null;
  }
}

// Yahoo's v8/chart endpoint is still useful for regular market price, but it
// does not provide AUM or AVAX holdings.
async function fetchVavxMarketPrice(): Promise<EtfLive | null> {
  try {
    const res = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/VAVX?interval=1d&range=5d',
      {
        headers: { 'User-Agent': USER_AGENT },
        next: { revalidate: 300 },
      },
      4000,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const marketPrice: number | null = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    if (marketPrice == null) return null;

    return {
      aum: null,
      avaxHoldings: null,
      navPerShare: null,
      marketPrice,
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

async function fetchVavx(): Promise<EtfLive | null> {
  const [vaneck, yahoo] = await Promise.all([fetchVavxFromVaneck(), fetchVavxMarketPrice()]);
  if (!vaneck && !yahoo) return null;

  return {
    aum: vaneck?.aum ?? null,
    avaxHoldings: vaneck?.avaxHoldings ?? null,
    navPerShare: vaneck?.navPerShare ?? yahoo?.navPerShare ?? null,
    marketPrice: yahoo?.marketPrice ?? null,
    asOfDate: vaneck?.asOfDate ?? null,
    source: vaneck?.source ?? 'yahoo',
  };
}

async function fetchBava(): Promise<EtfLive | null> {
  try {
    const res = await fetchWithTimeout('https://bavaetf.com/', {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const nextData = parseNextData(html) as {
      props?: {
        pageProps?: {
          fundData?: {
            data?: {
              fundDetails?: {
                netAssets?: number;
                stakingMetrics?: {
                  currentPercentageOfAssetsStaked?: number;
                  targetPercentageOfAssetsStaked?: number;
                  asOfDate?: string;
                };
                asOfDate?: string;
              };
              holdings?: {
                basket?: { companyName?: string; shares?: number; marketValue?: number }[];
                asOfDate?: string;
              };
              navAndMarketPrice?: {
                nav?: number;
                marketPrice?: number;
                asOfDate?: string;
              };
            };
          };
        };
      };
    } | null;

    const data = nextData?.props?.pageProps?.fundData?.data;
    const fundDetails = data?.fundDetails;
    const avax = data?.holdings?.basket?.find((holding) => /avalanche|avax/i.test(holding.companyName ?? ''));
    const stakingMetrics = fundDetails?.stakingMetrics;

    const aum = parseNumber(fundDetails?.netAssets);
    const avaxHoldings = parseNumber(avax?.shares);
    const navPerShare = parseNumber(data?.navAndMarketPrice?.nav);
    const marketPrice = parseNumber(data?.navAndMarketPrice?.marketPrice);
    const stakingPct = percentFromRatio(stakingMetrics?.currentPercentageOfAssetsStaked);
    const stakingMax = percentFromRatio(stakingMetrics?.targetPercentageOfAssetsStaked);

    if (!aum && !avaxHoldings && !navPerShare) return null;

    return {
      aum: aum ?? parseNumber(avax?.marketValue),
      avaxHoldings,
      navPerShare,
      marketPrice,
      stakingPct,
      stakingMax,
      asOfDate: data?.holdings?.asOfDate ?? fundDetails?.asOfDate ?? data?.navAndMarketPrice?.asOfDate ?? null,
      source: 'bitwise',
    };
  } catch {
    return null;
  }
}

function applyLiveEtf(etf: EtfEntry, live: EtfLive | null): EtfEntry {
  if (!live) return etf;
  return {
    ...etf,
    aum: live.aum ?? etf.aum,
    avaxHoldings: live.avaxHoldings ?? etf.avaxHoldings,
    navPerShare: live.navPerShare ?? etf.navPerShare,
    stakingPct: live.stakingPct ?? etf.stakingPct,
    stakingMax: live.stakingMax ?? etf.stakingMax,
  };
}

function withCurrentSponsorFee(etf: EtfEntry): EtfEntry {
  if (!etf.sponsorFeeWaiverEnd || etf.sponsorFeeAfterWaiver == null) return etf;
  const waiverEnd = new Date(`${etf.sponsorFeeWaiverEnd}T23:59:59Z`);
  if (Number.isNaN(waiverEnd.getTime()) || Date.now() <= waiverEnd.getTime()) return etf;
  return { ...etf, sponsorFee: etf.sponsorFeeAfterWaiver };
}

export async function GET() {
  const [avaxOneHoldings, vavx, bava] = await Promise.all([fetchAvaxOneHoldings(), fetchVavx(), fetchBava()]);

  const dats: DatEntry[] = DATS.map((dat) => {
    if (dat.id === 'avax-one' && avaxOneHoldings && avaxOneHoldings > 0) {
      return { ...dat, avaxHoldings: avaxOneHoldings };
    }
    return dat;
  });

  const etfs: EtfEntry[] = ETFS.map((etf) => {
    const feeAdjusted = withCurrentSponsorFee(etf);

    if (etf.id === 'vaneck-vavx' && vavx) {
      return applyLiveEtf(feeAdjusted, vavx);
    }

    if (etf.id === 'bitwise-bava' && bava) {
      return applyLiveEtf(feeAdjusted, bava);
    }

    return feeAdjusted;
  });

  return NextResponse.json(
    {
      dats,
      etfs,
      live: {
        avaxOneHoldings,
        vavx,
        bava,
      },
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    },
  );
}
