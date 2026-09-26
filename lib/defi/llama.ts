import { groupOf, type GroupKey } from "@/lib/defi/taxonomy";

/* DefiLlama's feeds, reduced to what the DeFi page reads. The protocol
   list is DefiLlama's own lite payload: it carries each protocol's
   Avalanche TVL a day, a week and a month back, so every change here is
   the Avalanche change, not the protocol's move across all chains.

   The page also splits the value in Avalanche protocols into layers, the
   way DefiLlama's chain figure is built. That figure counts every non-CEX
   protocol's TVL, less what vaults redeposit ("doublecounted") and less
   liquid staking, plus their overlap, and it leaves Bridge, Canonical
   Bridge and RWA protocols out. The sum reproduces DefiLlama's Avalanche
   TVL to the dollar. */

/* ------------------------------------------------------------------ */
/* the shapes the page reads                                           */
/* ------------------------------------------------------------------ */

export interface DefiProtocol {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  url: string | null;
  /** DefiLlama's own category */
  category: string;
  group: GroupKey;
  /** USD on Avalanche */
  tvl: number;
  /** the part of tvl that DefiLlama's Avalanche TVL counts */
  counted: number;
  /** what a vault redeposits into other protocols */
  doubleCounted: number;
  liquidStaking: number;
  /** USD borrowed against deposits on Avalanche; lending protocols only */
  borrowed: number | null;
  /** Avalanche TVL a day, a week and a month back */
  prevDay: number | null;
  prevWeek: number | null;
  prevMonth: number | null;
  mcap: number | null;
  /** 0..1: how much of the protocol's TVL across all chains is on Avalanche */
  avalancheShare: number | null;
  chains: number;
  /** unix seconds */
  listedAt: number | null;
  parent: string | null;
  volume24h: number | null;
  volume7d: number | null;
  volume30d: number | null;
  fees24h: number | null;
  fees7d: number | null;
  fees30d: number | null;
  /** the main C-Chain contract, for the explorer's address page */
  address: string | null;
  description: string | null;
  /** X handle */
  twitter: string | null;
}

export interface Layers {
  /** DefiLlama's Avalanche TVL */
  counted: number;
  /** liquid staking outside the vault layer */
  liquidStaking: number;
  /** what vaults redeposit into other protocols */
  doubleCounted: number;
  bridges: number;
  rwa: number;
  /** exchange reserves, not DeFi */
  cex: number;
  borrowed: number;
  /** every non-CEX protocol's Avalanche TVL, summed */
  gross: number;
}

export interface LayerPoint {
  /** unix seconds, UTC day */
  t: number;
  counted: number;
  liquidStaking: number;
  doubleCounted: number;
  borrowed: number | null;
}

export interface VolumeSeries {
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  /** percent: the last 7 days against the 7 before */
  change7d: number | null;
  change30d: number | null;
  /** [unix seconds, USD], oldest first */
  chart: [number, number][];
}

export interface DefiOverview {
  asOf: number;
  layers: Layers;
  history: LayerPoint[];
  dex: VolumeSeries | null;
  fees: VolumeSeries | null;
  protocols: DefiProtocol[];
}

/* ------------------------------------------------------------------ */
/* the raw payloads, only the fields read here                         */
/* ------------------------------------------------------------------ */

interface ChainTvl {
  tvl?: number | null;
  tvlPrevDay?: number | null;
  tvlPrevWeek?: number | null;
  tvlPrevMonth?: number | null;
}

export interface LiteProtocol {
  defillamaId?: string | number;
  name: string;
  category?: string | null;
  chains?: string[];
  chainTvls?: Record<string, ChainTvl>;
  tvl?: number | null;
  mcap?: number | null;
  logo?: string | null;
  url?: string | null;
  listedAt?: number | null;
  parentProtocol?: string | null;
}

/** the full protocol list's fields that the lite one lacks */
export interface FullProtocol {
  id: string | number;
  slug?: string | null;
  description?: string | null;
  twitter?: string | null;
  /** "avax:0x..." when DefiLlama knows a C-Chain address */
  address?: string | null;
}

export interface ProtocolMeta {
  slug: string | null;
  description: string | null;
  twitter: string | null;
  address: string | null;
}

export interface LiteCharts {
  tvl?: [string | number, number][];
  doublecounted?: [string | number, number][];
  liquidstaking?: [string | number, number][];
  dcAndLsOverlap?: [string | number, number][];
  borrowed?: [string | number, number][];
}

export interface DimensionOverview {
  total24h?: number | null;
  total7d?: number | null;
  total30d?: number | null;
  total14dto7d?: number | null;
  total60dto30d?: number | null;
  totalDataChart?: [number, number][];
  protocols?: { defillamaId?: string | number; name: string; total24h?: number | null; total7d?: number | null; total30d?: number | null }[];
}

/* ------------------------------------------------------------------ */
/* transforms                                                          */
/* ------------------------------------------------------------------ */

const EXCLUDED_FROM_TVL = new Set(["Bridge", "Canonical Bridge", "RWA", "CEX"]);

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const part = (p: LiteProtocol, key: string): number => num(p.chainTvls?.[key]?.tvl) ?? 0;

/** DefiLlama's slug: the icon URL carries it; the name is the fallback */
export function slugOf(p: Pick<LiteProtocol, "logo" | "name">): string {
  const m = /\/icons\/protocols\/([^/?#]+)/.exec(p.logo ?? "");
  if (m) return decodeURIComponent(m[1]);
  return p.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const DESCRIPTION_MAX = 280;

export function toMeta(full: FullProtocol[]): Map<string, ProtocolMeta> {
  const out = new Map<string, ProtocolMeta>();
  for (const p of full) {
    const m = /^avax:(0x[0-9a-fA-F]{40})$/.exec(p.address?.trim() ?? "");
    const d = p.description?.trim() || null;
    out.set(String(p.id), {
      slug: p.slug || null,
      description: d && d.length > DESCRIPTION_MAX ? `${d.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : d,
      twitter: p.twitter || null,
      address: m ? m[1].toLowerCase() : null,
    });
  }
  return out;
}

type Dimension = Map<string, { d: number | null; w: number | null; m: number | null }>;

function dimensionById(o: DimensionOverview | null): Dimension {
  const out: Dimension = new Map();
  for (const r of o?.protocols ?? []) {
    if (r.defillamaId === undefined) continue;
    out.set(String(r.defillamaId), { d: num(r.total24h), w: num(r.total7d), m: num(r.total30d) });
  }
  return out;
}

export function toProtocols(
  lite: LiteProtocol[],
  dex: DimensionOverview | null,
  fees: DimensionOverview | null,
  addressOf: (slug: string) => string | null = () => null,
  meta: Map<string, ProtocolMeta> = new Map(),
): DefiProtocol[] {
  const vol = dimensionById(dex);
  const fee = dimensionById(fees);
  return lite
    .filter((p) => part(p, "Avalanche") > 0)
    .map((p) => {
      const id = String(p.defillamaId ?? p.name);
      const category = p.category ?? "Other";
      const tvl = part(p, "Avalanche");
      const doubleCounted = part(p, "Avalanche-doublecounted");
      const liquidStaking = part(p, "Avalanche-liquidstaking");
      const overlap = part(p, "Avalanche-dcAndLsOverlap");
      const avax = p.chainTvls?.Avalanche ?? {};
      const total = num(p.tvl);
      const info = meta.get(id);
      const slug = info?.slug ?? slugOf(p);
      const v = vol.get(id);
      const f = fee.get(id);
      return {
        id,
        name: p.name,
        slug,
        logo: p.logo ?? null,
        url: p.url ?? null,
        category,
        group: groupOf(category),
        tvl,
        counted: EXCLUDED_FROM_TVL.has(category) ? 0 : Math.max(0, tvl - doubleCounted - liquidStaking + overlap),
        doubleCounted,
        liquidStaking,
        borrowed: p.chainTvls?.["Avalanche-borrowed"] ? part(p, "Avalanche-borrowed") : null,
        prevDay: num(avax.tvlPrevDay),
        prevWeek: num(avax.tvlPrevWeek),
        prevMonth: num(avax.tvlPrevMonth),
        mcap: num(p.mcap),
        avalancheShare: total && total > 0 ? Math.min(1, tvl / total) : null,
        chains: p.chains?.length ?? 1,
        listedAt: num(p.listedAt),
        parent: p.parentProtocol ?? null,
        volume24h: v?.d ?? null,
        volume7d: v?.w ?? null,
        volume30d: v?.m ?? null,
        fees24h: f?.d ?? null,
        fees7d: f?.w ?? null,
        fees30d: f?.m ?? null,
        // the registry's main contract first, then DefiLlama's C-Chain address
        address: addressOf(slug) ?? info?.address ?? null,
        description: info?.description ?? null,
        twitter: info?.twitter ?? null,
      };
    })
    .sort((a, b) => b.tvl - a.tvl);
}

/* The value in Avalanche protocols as disjoint layers:
   gross = counted + liquidStaking + doubleCounted + rwa + bridges. */
export function toLayers(protocols: DefiProtocol[]): Layers {
  const l: Layers = { counted: 0, liquidStaking: 0, doubleCounted: 0, bridges: 0, rwa: 0, cex: 0, borrowed: 0, gross: 0 };
  for (const p of protocols) {
    if (p.category === "CEX") {
      l.cex += p.tvl;
      continue;
    }
    l.gross += p.tvl;
    l.borrowed += p.borrowed ?? 0;
    if (p.category === "RWA") l.rwa += p.tvl;
    else if (p.category === "Bridge" || p.category === "Canonical Bridge") l.bridges += p.tvl;
    else {
      l.counted += p.counted;
      l.doubleCounted += p.doubleCounted;
      // staked AVAX a vault already holds is in the redeposit layer once, not twice
      l.liquidStaking += p.tvl - p.doubleCounted - p.counted;
    }
  }
  return l;
}

function seriesMap(s: [string | number, number][] | undefined): Map<number, number> {
  return new Map((s ?? []).map(([t, v]) => [Number(t), v]));
}

/** DefiLlama's chain chart as the page's layers, day by day, oldest first */
export function toHistory(c: LiteCharts | null): LayerPoint[] {
  if (!c?.tvl?.length) return [];
  const dc = seriesMap(c.doublecounted);
  const ls = seriesMap(c.liquidstaking);
  const ov = seriesMap(c.dcAndLsOverlap);
  const br = seriesMap(c.borrowed);
  return c.tvl
    .map(([t, total]) => {
      const day = Number(t);
      const d = dc.get(day) ?? 0;
      const s = ls.get(day) ?? 0;
      const o = ov.get(day) ?? 0;
      return {
        t: day,
        counted: Math.max(0, total - d - s + o),
        liquidStaking: Math.max(0, s - o),
        doubleCounted: d,
        borrowed: br.get(day) ?? null,
      };
    })
    .sort((a, b) => a.t - b.t);
}

/** percent change of one window against the window before it */
function over(now: number | null, before: number | null): number | null {
  return now !== null && before !== null && before > 0 ? ((now - before) / before) * 100 : null;
}

/* the change fields DefiLlama sends can read 0 while its window totals
   move, so the change is taken from the totals themselves */
export function toVolume(o: DimensionOverview | null): VolumeSeries | null {
  if (!o) return null;
  return {
    total24h: num(o.total24h),
    total7d: num(o.total7d),
    total30d: num(o.total30d),
    change7d: over(num(o.total7d), num(o.total14dto7d)),
    change30d: over(num(o.total30d), num(o.total60dto30d)),
    chart: (o.totalDataChart ?? []).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v)).sort((a, b) => a[0] - b[0]),
  };
}

/* ------------------------------------------------------------------ */
/* changes                                                             */
/* ------------------------------------------------------------------ */

export type Span = "1d" | "7d" | "30d";

export function prevOf(p: DefiProtocol, w: Span): number | null {
  return w === "1d" ? p.prevDay : w === "7d" ? p.prevWeek : p.prevMonth;
}

/** percent change of the Avalanche TVL over the window; null without a base */
export function changeOf(p: DefiProtocol, w: Span): number | null {
  const prev = prevOf(p, w);
  return prev && prev > 0 ? ((p.tvl - prev) / prev) * 100 : null;
}

/** USD change of the Avalanche TVL over the window */
export function deltaOf(p: DefiProtocol, w: Span): number | null {
  const prev = prevOf(p, w);
  return prev === null ? null : p.tvl - prev;
}

/* ------------------------------------------------------------------ */
/* yields                                                              */
/* ------------------------------------------------------------------ */

export interface YieldPool {
  /** DefiLlama's pool id, for its pool page */
  id: string;
  /** the protocol's DefiLlama slug */
  project: string;
  symbol: string;
  /** DefiLlama's note on the pool, such as a fee tier or a lock */
  meta: string | null;
  tvl: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apyMean30d: number | null;
  /** APY points gained or lost over 7 days */
  apyChange7d: number | null;
  stablecoin: boolean;
  /** the pool can lose value to impermanent loss */
  ilRisk: boolean;
  /** one asset, or a pair or basket */
  single: boolean;
  volume1d: number | null;
  /** DefiLlama flags the APY as an outlier */
  outlier: boolean;
}

export interface RawPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  poolMeta?: string | null;
  tvlUsd?: number | null;
  apy?: number | null;
  apyBase?: number | null;
  apyReward?: number | null;
  apyMean30d?: number | null;
  apyPct7D?: number | null;
  stablecoin?: boolean | null;
  ilRisk?: string | null;
  exposure?: string | null;
  volumeUsd1d?: number | null;
  outlier?: boolean | null;
}

export function toPools(raw: RawPool[]): YieldPool[] {
  return raw
    .filter((p) => p.chain === "Avalanche" && (num(p.tvlUsd) ?? 0) > 0)
    .map((p) => ({
      id: p.pool,
      project: p.project,
      symbol: p.symbol,
      meta: p.poolMeta || null,
      tvl: num(p.tvlUsd) ?? 0,
      apy: num(p.apy),
      apyBase: num(p.apyBase),
      apyReward: num(p.apyReward),
      apyMean30d: num(p.apyMean30d),
      apyChange7d: num(p.apyPct7D),
      stablecoin: !!p.stablecoin,
      ilRisk: p.ilRisk === "yes",
      single: p.exposure === "single",
      volume1d: num(p.volumeUsd1d),
      outlier: !!p.outlier,
    }))
    .sort((a, b) => b.tvl - a.tvl);
}
