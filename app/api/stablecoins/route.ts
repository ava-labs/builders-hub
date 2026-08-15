import { NextResponse } from "next/server";
import {
  CURRENCY_INFO,
  STABLECOIN_META,
  type StablecoinAsset,
  type StablecoinHistoryPoint,
  type StablecoinStackKey,
  type StablecoinStackPoint,
  type StablecoinsApiResponse,
} from "@/lib/stablecoins";

/* Stablecoins on Avalanche, assembled from DefiLlama's pegged-assets API
   (the same upstream the Apps facet uses for protocol TVL) and the curated
   issuer registry in lib/stablecoins. Two feeds, one payload:
   - /stablecoins        -> the current roster with per-chain circulating
   - /stablecoincharts   -> the full daily history for the chain, per peg
   Values from the roster endpoint are already USD-denominated (verified
   against the charts endpoint's totalCirculatingUSD for JPY/TRY/CHF pegs). */

const LLAMA_STABLECOINS_API = "https://stablecoins.llama.fi";
const CHAIN = "Avalanche";
/* dust filter: sub-$1k relics (dead pegs, test mints) would triple the
   table length without moving any number */
const MIN_CIRCULATING_USD = 1_000;
/* the stacked chart names as many coins as the treemap has validated
   colors; the rest ride the gray "other" band */
const STACK_COINS = 5;

/* DefiLlama's pegged-asset icon CDN keys off the slugged name */
function logoUrl(name: string): string {
  return `https://icons.llamao.fi/icons/pegged/${name.toLowerCase().replace(/\s+/g, "-")}?w=48&h=48`;
}

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface LlamaChainCirculating {
  current?: Record<string, number>;
  circulatingPrevDay?: Record<string, number>;
  circulatingPrevWeek?: Record<string, number>;
  circulatingPrevMonth?: Record<string, number>;
}

interface LlamaPeggedAsset {
  id: string;
  name: string;
  symbol: string;
  pegType: string;
  pegMechanism?: string;
  price?: number | null;
  chainCirculating?: Record<string, LlamaChainCirculating>;
}

interface LlamaChartPoint {
  date: string;
  totalCirculatingUSD?: Record<string, number>;
  totalMintedUSD?: Record<string, number>;
  totalBridgedToUSD?: Record<string, number>;
}

function sumValues(rec: Record<string, number> | undefined): number | null {
  if (!rec) return null;
  let total = 0;
  let seen = false;
  for (const v of Object.values(rec)) {
    if (Number.isFinite(v)) {
      total += v;
      seen = true;
    }
  }
  return seen ? total : null;
}

async function fetchRoster(): Promise<StablecoinAsset[]> {
  const res = await fetch(`${LLAMA_STABLECOINS_API}/stablecoins?includePrices=true`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`stablecoins roster HTTP ${res.status}`);
  const data = (await res.json()) as { peggedAssets: LlamaPeggedAsset[] };

  const assets: StablecoinAsset[] = [];
  for (const asset of data.peggedAssets) {
    const chain = asset.chainCirculating?.[CHAIN];
    const mcap = sumValues(chain?.current);
    if (!chain || mcap === null || mcap < MIN_CIRCULATING_USD) continue;

    const currency = CURRENCY_INFO[asset.pegType];
    // peggedVAR and other non-currency pegs don't belong in a by-country view
    if (!currency) continue;

    const meta = STABLECOIN_META[asset.id] ?? {};
    assets.push({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      logo: logoUrl(asset.name),
      pegCurrency: currency.code,
      mechanism: asset.pegMechanism ?? "unknown",
      price: Number.isFinite(asset.price as number) ? (asset.price as number) : null,
      mcap,
      prevDay: sumValues(chain.circulatingPrevDay),
      prevWeek: sumValues(chain.circulatingPrevWeek),
      prevMonth: sumValues(chain.circulatingPrevMonth),
      ...meta,
    });
  }
  return assets.sort((a, b) => b.mcap - a.mcap);
}

async function fetchHistory(): Promise<StablecoinHistoryPoint[]> {
  const res = await fetch(`${LLAMA_STABLECOINS_API}/stablecoincharts/${CHAIN}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`stablecoin charts HTTP ${res.status}`);
  const data = (await res.json()) as LlamaChartPoint[];

  return data.map((point) => {
    const byCurrency: Record<string, number> = {};
    let total = 0;
    for (const [pegType, usd] of Object.entries(point.totalCirculatingUSD ?? {})) {
      if (!Number.isFinite(usd) || usd <= 0) continue;
      const code = CURRENCY_INFO[pegType]?.code ?? pegType.replace(/^pegged/, "");
      byCurrency[code] = (byCurrency[code] ?? 0) + usd;
      total += usd;
    }
    return {
      date: Number(point.date),
      total,
      minted: sumValues(point.totalMintedUSD) ?? 0,
      bridged: sumValues(point.totalBridgedToUSD) ?? 0,
      byCurrency,
    };
  });
}

/* one coin's daily USD series on Avalanche, keyed by day */
async function fetchCoinSeries(id: string): Promise<Map<number, number>> {
  const res = await fetch(`${LLAMA_STABLECOINS_API}/stablecoincharts/${CHAIN}?stablecoin=${id}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`stablecoin ${id} charts HTTP ${res.status}`);
  const data = (await res.json()) as LlamaChartPoint[];
  const series = new Map<number, number>();
  for (const point of data) {
    series.set(Number(point.date), sumValues(point.totalCirculatingUSD) ?? 0);
  }
  return series;
}

/* The stacked market-cap series: the top coins each get a band, the rest
   is the aggregate total minus the named bands. A coin whose history
   fetch fails simply folds into "other" instead of sinking the payload. */
async function buildStack(
  assets: StablecoinAsset[],
  history: StablecoinHistoryPoint[],
): Promise<StablecoinsApiResponse["stack"]> {
  const top = assets.slice(0, STACK_COINS);
  const results = await Promise.allSettled(top.map((a) => fetchCoinSeries(a.id)));

  const keys: StablecoinStackKey[] = [];
  const series: Map<number, number>[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      keys.push({ id: top[i].id, symbol: top[i].symbol, logo: top[i].logo });
      series.push(r.value);
    }
  });

  // Some per-coin series go stale upstream while the roster still counts
  // the coin (USP's stopped in June 2026 at $65M): carry the last known
  // value across gaps so a live coin doesn't silently fold into "other".
  // Before a coin's first datapoint the band is genuinely zero.
  const lastKnown = keys.map(() => 0);
  const points: StablecoinStackPoint[] = history.map((p) => {
    const coins: Record<string, number> = {};
    let named = 0;
    keys.forEach((k, i) => {
      const usd = series[i].get(p.date) ?? lastKnown[i];
      lastKnown[i] = usd;
      coins[k.id] = usd;
      named += usd;
    });
    return {
      date: p.date,
      coins,
      other: Math.max(0, p.total - named),
      total: p.total,
    };
  });

  return { keys, points };
}

export async function GET() {
  try {
    const [assets, history] = await Promise.all([fetchRoster(), fetchHistory()]);
    const stack = await buildStack(assets, history);
    const response: StablecoinsApiResponse = {
      assets,
      history,
      stack,
      updatedAt: Date.now(),
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching stablecoin data:", error);
    return NextResponse.json({ error: "Failed to fetch stablecoin data" }, { status: 500 });
  }
}
