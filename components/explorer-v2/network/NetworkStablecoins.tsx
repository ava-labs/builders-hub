"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { ResponsiveContainer, Tooltip as RechartsTooltip, Treemap } from "recharts";
import { cn } from "@/lib/utils";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { Board, ChartBoard, EmptyRow, HEAD, INK, MUTED, ROW, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { ChartEmpty } from "@/components/explorer-v2/staking/bits";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";
import { StablecoinMap, type CoveredCountry } from "@/components/explorer-v2/network/StablecoinMap";
import { HoverReadout, HoverRow } from "@/components/explorer-v2/network/stablecoin-hover";
import { CutChips, LayerBlock, SharePanel, type BlockDay, type BlockLayer, type CutChip, type SharePart } from "@/components/explorer-v2/network/icm-parts";
import type { StablecoinAsset, StablecoinsApiResponse } from "@/lib/stablecoins";

/* The network scope's stablecoin observatory in the C-Chain home's voice:
   readouts with the market's history poured into them, the market cap as
   one large block (one layer per top coin), then dominance, currency,
   backing and peg panels. Every mark on them cuts the stablecoin table
   below, and the cut shows as chips over it; the map lights the countries
   the cut rows answer to. Supply and prices come from DefiLlama through
   /api/stablecoins; issuers and jurisdictions are the curated registry in
   lib/stablecoins. */

/* The categorical slots, one per dominance rank, shared by the market
   block and the treemap. Red belongs to alerts, so the leader wears ink;
   the rest passed scripts/validate_palette.js (dataviz skill) against
   their surface. Everything past rank five wears the block gray and
   leans on its direct label. */
const TREEMAP_STYLE = `
.sc-map {
  --sc-0: #3F3F46; --sc-1: #2456A6; --sc-2: #E09A10; --sc-3: #28ADBF; --sc-4: #8B5CF6;
  --sc-tail: #A2AFB2; --sc-gap: #ffffff;
  --sc-ink-0: #ffffff; --sc-ink-1: #ffffff; --sc-ink-2: #18181b;
  --sc-ink-3: #18181b; --sc-ink-4: #ffffff; --sc-ink-tail: #18181b;
}
.dark .sc-map {
  --sc-0: #D4D4D8; --sc-1: #2D59B5; --sc-2: #BD8118; --sc-3: #17A2B4; --sc-4: #9572F5;
  --sc-tail: #52525B; --sc-gap: #09090b;
  --sc-ink-0: #09090b; --sc-ink-2: #09090b; --sc-ink-3: #09090b; --sc-ink-tail: #fafafa;
}`;

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function fmtUsd(v: number): string {
  return `$${usdCompact.format(v)}`;
}

function fmtPrice(p: number | null): string | null {
  if (p === null) return null;
  return `$${p >= 0.01 ? p.toFixed(3) : p.toFixed(4)}`;
}

function pctChange(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

const MECHANISM_LABEL: Record<string, string> = {
  "fiat-backed": "Fiat",
  "crypto-backed": "Crypto",
  algorithmic: "Algorithmic",
};

/* EU member states whose tokens fold into the Europe row when Group EU
   is on; the flag rides along so the toggle flips both column cells */
const EU_COUNTRIES = new Set(["France", "Germany", "Ireland", "Netherlands", "Italy", "Spain"]);

/* the two country readings a row can give, driven by the Group EU toggle:
   grouped keys off the currency anchor, ungrouped prefers the issuer's
   own jurisdiction */
function rowCountry(asset: StablecoinAsset, groupEU: boolean): { country: string; flag: string } {
  const anchor = { country: anchorCountry(asset.pegCurrency), flag: anchorFlag(asset.pegCurrency) };
  const issuer = asset.country ? { country: asset.country, flag: asset.flag ?? anchor.flag } : anchor;
  if (!groupEU) return issuer;
  if (asset.pegCurrency === "EUR" || EU_COUNTRIES.has(issuer.country)) return anchor;
  return issuer;
}

const CURRENCY_ANCHOR: Record<string, { country: string; flag: string }> = {
  USD: { country: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  EUR: { country: "Europe", flag: "\u{1F1EA}\u{1F1FA}" },
  JPY: { country: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  CHF: { country: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}" },
  SGD: { country: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  TRY: { country: "Turkey", flag: "\u{1F1F9}\u{1F1F7}" },
  GBP: { country: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  AUD: { country: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  BRL: { country: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  MXN: { country: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
};

function anchorCountry(code: string): string {
  return CURRENCY_ANCHOR[code]?.country ?? code;
}
function anchorFlag(code: string): string {
  return CURRENCY_ANCHOR[code]?.flag ?? "";
}

/* ISO 3166-1 numeric ids for the map, matching the vendored topology */
const COUNTRY_ID: Record<string, string> = {
  "United States": "840",
  "El Salvador": "222",
  Japan: "392",
  Switzerland: "756",
  Liechtenstein: "438",
  Singapore: "702",
  Turkey: "792",
  "United Kingdom": "826",
  Australia: "036",
  Brazil: "076",
  Mexico: "484",
  France: "250",
};

/* the euro's legal-tender countries: one EUR token covers all of them */
const EUROZONE: [string, string][] = [
  ["040", "Austria"],
  ["056", "Belgium"],
  ["191", "Croatia"],
  ["196", "Cyprus"],
  ["233", "Estonia"],
  ["246", "Finland"],
  ["250", "France"],
  ["276", "Germany"],
  ["300", "Greece"],
  ["372", "Ireland"],
  ["380", "Italy"],
  ["428", "Latvia"],
  ["440", "Lithuania"],
  ["442", "Luxembourg"],
  ["470", "Malta"],
  ["528", "Netherlands"],
  ["620", "Portugal"],
  ["703", "Slovakia"],
  ["705", "Slovenia"],
  ["724", "Spain"],
];

/* ---- data ---- */

function useStablecoins() {
  const [data, setData] = useState<StablecoinsApiResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch("/api/stablecoins")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload: StablecoinsApiResponse) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { data, error, retry: () => setAttempt((n) => n + 1) };
}

/* ---- small parts ---- */

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{children}</span>;
}

function RetryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
    >
      {children}
    </button>
  );
}

/* coin logo with a monogram fallback, the ChainLogo rule */
function TokenLogo({ uri, symbol }: { uri?: string; symbol: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {symbol.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-5 w-5 shrink-0 rounded-full object-contain" />;
}

/* signed percent for the table's supply-change cells */
function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  const up = value >= 0;
  return (
    <span className={cn("font-mono text-[12px] tabular-nums", Math.abs(value) < 0.05 ? "text-zinc-400 dark:text-zinc-500" : up ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300")}>
      {up ? "+" : ""}
      {Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}%
    </span>
  );
}

/* toggle chip in the TypeFilterRail's grammar */
function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
      )}
    >
      <span className={cn("size-1 shrink-0", active ? "bg-current" : "bg-zinc-300 dark:bg-zinc-600")} aria-hidden />
      {label}
    </button>
  );
}

/* ---- the dominance treemap ---- */

interface TreemapDatum {
  id: string;
  name: string;
  symbol: string;
  size: number;
  share: number;
  rank: number;
  logo?: string;
}

const OTHER = "__other";

function TreemapCell(props: Record<string, unknown>) {
  const { x, y, width, height, depth, picked, onPick } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    picked: string | null;
    onPick: (id: string) => void;
  };
  const datum = props as unknown as TreemapDatum;
  if (depth < 1 || !Number.isFinite(width) || width <= 0 || height <= 0) return null;
  const slot = datum.rank < 5 ? String(datum.rank) : "tail";
  const showLabel = width >= 52 && height >= 36;
  const showShare = width >= 64 && height >= 54;
  // a failed SVG <image> renders nothing, so the logo needs no fallback
  const showLogo = datum.logo && width >= 76;
  const pickable = datum.id !== OTHER;
  const on = picked === datum.id;
  return (
    <g
      onClick={pickable ? () => onPick(datum.id) : undefined}
      className={cn("transition-opacity duration-200", pickable && "cursor-pointer")}
      opacity={picked && !on ? 0.3 : 1}
    >
      <rect x={x} y={y} width={width} height={height} fill={`var(--sc-${slot})`} stroke="var(--sc-gap)" strokeWidth={2} />
      {on && <rect x={x + 2} y={y + 2} width={Math.max(0, width - 4)} height={Math.max(0, height - 4)} fill="none" stroke="#0061E2" strokeWidth={2} />}
      {showLabel && showLogo && (
        <>
          {/* the CDN flattens icon transparency onto white squares; a
              circular clip turns them into coin badges */}
          <clipPath id={`sc-dom-clip-${datum.rank}`}>
            <circle cx={x + 17.5} cy={y + 16.5} r={7.5} />
          </clipPath>
          <image href={datum.logo} x={x + 10} y={y + 9} width={15} height={15} clipPath={`url(#sc-dom-clip-${datum.rank})`} />
        </>
      )}
      {showLabel && (
        <text x={x + 10 + (showLogo ? 20 : 0)} y={y + 20} fill={`var(--sc-ink-${slot})`} fontSize={12} fontWeight={700} fontFamily="var(--font-mono, ui-monospace, monospace)">
          {datum.symbol}
        </text>
      )}
      {showShare && (
        <text x={x + 10} y={y + 37} fill={`var(--sc-ink-${slot})`} fillOpacity={0.75} fontSize={10} fontFamily="var(--font-mono, ui-monospace, monospace)">
          {datum.share.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

/* peg deviation as a diverging bar around the dollar: ink inside 30 bp,
   amber inside 100 bp, red past it (the one alert on the page) */
function PegBar({ bp, scale }: { bp: number; scale: number }) {
  const abs = Math.abs(bp);
  const tone = abs <= 30 ? "bg-zinc-500 dark:bg-zinc-400" : abs <= 100 ? "bg-amber-500" : "bg-[#E6212F]";
  const w = Math.min(50, (abs / scale) * 50);
  return (
    <span className="relative block h-2 w-full bg-zinc-100 dark:bg-zinc-900">
      <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-300 dark:bg-zinc-700" />
      <span className={cn("absolute inset-y-0", tone)} style={bp >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
    </span>
  );
}

interface Cut {
  token?: string;
  currency?: string;
  mechanism?: string;
  /** a map country, by ISO numeric id */
  country?: string;
}

/* the table's columns at md and up; a tablet scrolls, phones stack */
const COLS = "md:grid-cols-[minmax(0,1.2fr)_4rem_minmax(0,1.3fr)_5.5rem_minmax(0,1fr)_5.5rem_6rem_4.5rem_4.5rem_4.5rem]";

export function NetworkStablecoins() {
  const range = useExplorerTimeRange();
  const { data, error, retry } = useStablecoins();

  const [groupEU, setGroupEU] = useState(true);
  const [excludeUSD, setExcludeUSD] = useState(false);
  const [query, setQuery] = useState("");
  const [cut, setCut] = useState<Cut>({});
  const cutBy = (key: keyof Cut, value: string) => setCut((c) => ({ ...c, [key]: c[key] === value ? undefined : value }));

  const assets = useMemo(() => data?.assets ?? [], [data]);
  const history = useMemo(() => data?.history ?? [], [data]);
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  /* ---- headline readings ---- */

  const totalMcap = useMemo(() => assets.reduce((sum, a) => sum + a.mcap, 0), [assets]);
  const latest = history.length ? history[history.length - 1] : null;
  const windowDays = Math.max(7, RANGE_DAYS[range]);
  const recent = useMemo(() => thin(windowSeries(history, windowDays), 120), [history, windowDays]);

  // market cap vs the clock's window ago, off the daily history
  const mcapDelta = useMemo(() => {
    if (history.length < 2) return null;
    const prev = history[Math.max(0, history.length - 1 - RANGE_DAYS[range])];
    return pctChange(history[history.length - 1].total, prev.total);
  }, [history, range]);

  const currencies = useMemo(() => {
    const totals = new Map<string, number>();
    for (const a of assets) totals.set(a.pegCurrency, (totals.get(a.pegCurrency) ?? 0) + a.mcap);
    return [...totals.entries()].sort((x, y) => y[1] - x[1]);
  }, [assets]);

  const jurisdictions = useMemo(() => new Set(assets.map((a) => rowCountry(a, false).country)).size, [assets]);
  const nativeShare = latest && latest.total > 0 ? (latest.minted / latest.total) * 100 : null;

  /* ---- the market block ---- */

  // one layer per named coin in rank order, floor up, the tail on top,
  // in the treemap's slots so both instruments speak the same colors
  const stackKeys = useMemo(() => data?.stack.keys ?? [], [data]);
  const layers = useMemo<BlockLayer[]>(
    () => [...stackKeys.map((k, i) => ({ key: k.id, label: k.symbol, tone: `var(--sc-${i})` })), { key: OTHER, label: "Other", tone: "var(--sc-tail)" }],
    [stackKeys],
  );
  const capDays = useMemo<BlockDay[]>(() => {
    const pts = (data?.stack.points ?? []).map((p) => ({ date: new Date(p.date * 1000).toISOString().slice(0, 10), v: { ...p.coins, [OTHER]: p.other } }));
    return thin(windowSeries(pts, windowDays), 200);
  }, [data, windowDays]);

  const treemapCells = useMemo<TreemapDatum[]>(() => {
    if (!totalMcap) return [];
    const named = assets.filter((a) => a.mcap / totalMcap >= 0.005).slice(0, 9);
    const rest = totalMcap - named.reduce((sum, a) => sum + a.mcap, 0);
    const cells: TreemapDatum[] = named.map((a, i) => ({ id: a.id, name: a.name, symbol: a.symbol, size: a.mcap, share: (a.mcap / totalMcap) * 100, rank: i, logo: a.logo }));
    if (rest > 0) {
      cells.push({ id: OTHER, name: `${assets.length - named.length} more stablecoins`, symbol: "OTHER", size: rest, share: (rest / totalMcap) * 100, rank: 99 });
    }
    return cells;
  }, [assets, totalMcap]);

  const backingParts = useMemo<SharePart[]>(() => {
    const groups = new Map<string, { usd: number; count: number }>();
    for (const a of assets) {
      const g = groups.get(a.mechanism) ?? { usd: 0, count: 0 };
      g.usd += a.mcap;
      g.count += 1;
      groups.set(a.mechanism, g);
    }
    return [...groups.entries()]
      .sort((x, y) => y[1].usd - x[1].usd)
      .map(([mechanism, g]) => ({
        key: mechanism,
        label: MECHANISM_LABEL[mechanism] ?? mechanism,
        value: g.usd,
        lead: (
          <>
            <span className="truncate">{MECHANISM_LABEL[mechanism] ?? mechanism}</span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">{g.count} tokens</span>
          </>
        ),
      }));
  }, [assets]);

  // USD tokens with a price feed, read as basis points off the dollar.
  // Feeds more than 20% off peg are stale pools, not depegs (DefiLlama
  // quotes MIM at $0.07): they stay in the table but are left out here.
  const pegWatch = useMemo(() => {
    return assets
      .filter((a) => a.pegCurrency === "USD" && a.price !== null && a.mcap >= 100_000)
      .map((a) => ({ ...a, bp: (a.price! - 1) * 10_000 }))
      .filter((a) => Math.abs(a.bp) <= 2_000)
      .sort((x, y) => Math.abs(y.bp) - Math.abs(x.bp))
      .slice(0, 8);
  }, [assets]);
  const pegScale = Math.max(50, ...pegWatch.map((a) => Math.abs(a.bp)));

  // the map's coverage: currency anchors (every euro country for EUR)
  // plus each curated issuer jurisdiction, and which assets reach each
  const { coverage, reach } = useMemo(() => {
    const cov = new Map<string, CoveredCountry>();
    // one asset can reach a country twice (anchor and issuer both United
    // States): count it once per country
    const seen = new Map<string, Set<string>>();
    const add = (id: string, name: string, flag: string, a: StablecoinAsset) => {
      const ids = seen.get(id) ?? new Set<string>();
      if (ids.has(a.id)) return;
      ids.add(a.id);
      seen.set(id, ids);
      const entry = cov.get(id) ?? { name, flag, tokens: [], usd: 0 };
      // distinct assets can share a ticker (two BUSDs): merge their rows
      const token = entry.tokens.find((t) => t.symbol === a.symbol);
      if (token) token.usd += a.mcap;
      else entry.tokens.push({ symbol: a.symbol, logo: a.logo, usd: a.mcap });
      entry.usd += a.mcap;
      cov.set(id, entry);
    };
    for (const a of assets) {
      if (a.pegCurrency === "EUR") {
        for (const [id, name] of EUROZONE) add(id, name, "\u{1F1EA}\u{1F1FA}", a);
      } else {
        const anchor = CURRENCY_ANCHOR[a.pegCurrency];
        const id = anchor && COUNTRY_ID[anchor.country];
        if (anchor && id) add(id, anchor.country, anchor.flag, a);
      }
      if (a.country && COUNTRY_ID[a.country]) add(COUNTRY_ID[a.country], a.country, a.flag ?? "", a);
    }
    return { coverage: cov, reach: seen };
  }, [assets]);

  /* ---- the table, cut ---- */

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .map((a) => ({ asset: a, loc: rowCountry(a, groupEU) }))
      .filter(({ asset }) => !excludeUSD || asset.pegCurrency !== "USD")
      .filter(({ asset }) => !cut.token || asset.id === cut.token)
      .filter(({ asset }) => !cut.currency || asset.pegCurrency === cut.currency)
      .filter(({ asset }) => !cut.mechanism || asset.mechanism === cut.mechanism)
      .filter(({ asset }) => !cut.country || reach.get(cut.country)?.has(asset.id))
      .filter(
        ({ asset, loc }) =>
          !q ||
          asset.symbol.toLowerCase().includes(q) ||
          asset.name.toLowerCase().includes(q) ||
          asset.pegCurrency.toLowerCase().includes(q) ||
          (asset.issuer ?? "").toLowerCase().includes(q) ||
          loc.country.toLowerCase().includes(q),
      );
  }, [assets, groupEU, excludeUSD, query, cut, reach]);

  const chips: CutChip[] = [
    cut.token ? { key: "token", label: byId.get(cut.token)?.symbol ?? cut.token } : null,
    cut.currency ? { key: "currency", label: `pegged to ${cut.currency}` } : null,
    cut.mechanism ? { key: "mechanism", label: `${MECHANISM_LABEL[cut.mechanism] ?? cut.mechanism}-backed` } : null,
    cut.country ? { key: "country", label: `answers to ${coverage.get(cut.country)?.name ?? cut.country}` } : null,
  ].filter((c): c is CutChip => c !== null);
  const cutting = chips.length > 0 || excludeUSD || query.trim() !== "";

  // the map lights the countries the cut rows answer to
  const lit = useMemo(() => {
    if (!cutting) return null;
    const rowIds = new Set(tableRows.map((r) => r.asset.id));
    const out = new Set<string>();
    for (const [id, ids] of reach) for (const a of ids) if (rowIds.has(a)) out.add(id);
    return out;
  }, [cutting, tableRows, reach]);

  /* ---- render ---- */

  let body: React.ReactNode;
  if (!data && !error) {
    body = (
      <div className="flex flex-col gap-12" aria-label="Loading stablecoin data" role="status">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
        <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Failed to load stablecoin data</p>
        <RetryButton onClick={retry}>Retry</RetryButton>
      </div>
    );
  } else {
    body = (
      <div className="sc-map flex flex-col gap-12">
        <style>{TREEMAP_STYLE}</style>

        {/* the market's readings; the market cap reads the same daily
            history the block below draws, and moves with the clock */}
        <ReadoutRow cols={4}>
          <Readout label="Market Cap" value={fmtUsd(latest?.total ?? totalMcap)} sub={rangeWindowLabel(range)} delta={mcapDelta} spark={recent.map((p) => p.total)} />
          <Readout
            label="Stablecoins"
            value={assets.length.toLocaleString("en-US")}
            sub={assets[0] ? `${assets[0].symbol} leads at ${((assets[0].mcap / totalMcap) * 100).toFixed(1)}%` : undefined}
          />
          <Readout label="Currencies" value={String(currencies.length)} sub={`${jurisdictions} jurisdictions`} />
          <Readout
            label="Natively Issued"
            value={nativeShare !== null ? `${nativeShare.toFixed(1)}%` : "—"}
            sub={latest ? `${fmtUsd(latest.bridged)} bridged in` : undefined}
            spark={recent.map((p) => (p.total > 0 ? (p.minted / p.total) * 100 : 0))}
          />
        </ReadoutRow>

        {/* the market cap as one block: a band per top coin, the rest in
            gray; a coin's key cuts the table to it */}
        {capDays.length ? (
          <LayerBlock
            label="Market Cap"
            note={RANGE_DAYS[range] < 7 ? "7 days" : rangeWindowLabel(range)}
            days={capDays}
            layers={layers}
            fmt={fmtUsd}
            headline="last"
            picked={cut.token && layers.some((l) => l.key === cut.token) ? cut.token : null}
            onPick={(k) => k !== OTHER && cutBy("token", k)}
          />
        ) : (
          <Board divide={false} className="border">
            <EmptyRow>No history</EmptyRow>
          </Board>
        )}

        {/* how the market splits: by token, then by currency and country */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard label="Dominance" className="flex min-w-0 flex-col" bodyClassName="flex flex-1 flex-col" action={<Chip>Current</Chip>}>
            {treemapCells.length ? (
              <div className="min-h-72 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapCells}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    isAnimationActive={false}
                    content={<TreemapCell picked={cut.token ?? null} onPick={(id: string) => cutBy("token", id)} />}
                  >
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as TreemapDatum;
                        return (
                          <HoverReadout label={d.name} value={fmtUsd(d.size)}>
                            <HoverRow swatch={`var(--sc-${d.rank < 5 ? d.rank : "tail"})`} logo={d.logo} label={d.symbol} share={`${d.share.toFixed(1)}%`} />
                          </HoverReadout>
                        );
                      }}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty failed={false} label="No data" />
            )}
          </ChartBoard>

          <ChartBoard label="By Currency" className="flex min-w-0 flex-col" bodyClassName="flex flex-1 flex-col justify-center" action={<Chip>{coverage.size} countries</Chip>}>
            <div className="flex flex-col gap-4">
              <StablecoinMap coverage={coverage} lit={lit} picked={cut.country ?? null} onPick={(id) => cutBy("country", id)} />
              <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                {currencies.map(([code, usd]) => {
                  const on = cut.currency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => cutBy("currency", code)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                        on
                          ? "bg-[#0061E2]/[0.08] text-[#0061E2] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                      )}
                    >
                      <span className="text-[13px] leading-none">{anchorFlag(code)}</span>
                      {code}
                      <span className={cn("tabular-nums", on ? "" : "text-zinc-900 dark:text-zinc-100")}>{fmtUsd(usd)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </ChartBoard>
        </div>

        {/* what stands behind the peg, and how tightly it holds */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <SharePanel
            label="Backing"
            action={<Chip>Current</Chip>}
            parts={backingParts}
            total={totalMcap}
            fmt={fmtUsd}
            picked={cut.mechanism ?? null}
            onPick={(k) => cutBy("mechanism", k)}
          />

          <ChartBoard label="USD Peg Watch" bodyClassName="p-0 md:px-0" action={<Chip>Current</Chip>}>
            {pegWatch.length === 0 ? (
              <EmptyRow>No price feeds</EmptyRow>
            ) : (
              <ul>
                {pegWatch.map((a) => {
                  const on = cut.token === a.id;
                  return (
                    <li key={a.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => cutBy("token", a.id)}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem] items-center gap-x-3 px-5 py-2.5 text-left transition-colors md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.5rem_4rem] md:px-6",
                          on ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <TokenLogo uri={a.logo} symbol={a.symbol} />
                          <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{a.symbol}</span>
                          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 sm:inline dark:text-zinc-500">{fmtUsd(a.mcap)}</span>
                        </span>
                        <PegBar bp={a.bp} scale={pegScale} />
                        <span className={cn(MUTED, "hidden text-right md:block")}>{fmtPrice(a.price)}</span>
                        <span className={cn(INK, "text-right")}>
                          {a.bp >= 0 ? "+" : ""}
                          {Math.round(a.bp)} bp
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChartBoard>
        </div>

        {/* the roster: every token, its currency, and where it answers to */}
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader
            label="Stablecoins"
            action={
              <Chip>
                {tableRows.length === assets.length ? `${assets.length} tokens` : `${tableRows.length} of ${assets.length}`}
              </Chip>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-72 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
              <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by token, issuer or country"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <ToggleChip label="Group EU" active={groupEU} onClick={() => setGroupEU((v) => !v)} />
            <ToggleChip label="Exclude USD" active={excludeUSD} onClick={() => setExcludeUSD((v) => !v)} />
          </div>
          <CutChips chips={chips} onDrop={(k) => setCut((c) => ({ ...c, [k]: undefined }))} onClear={() => setCut({})} />
          <Board divide={false}>
            <div className="overflow-x-auto">
              <div className="md:min-w-[64rem] xl:min-w-0">
                <div className={cn(HEAD, COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
                  <span>Country</span>
                  <span>Currency</span>
                  <span>Token</span>
                  <span>Backed By</span>
                  <span>Issuer</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Market Cap</span>
                  <span className="text-right">24h</span>
                  <span className="text-right">7d</span>
                  <span className="text-right">30d</span>
                </div>
                {tableRows.map(({ asset, loc }) => (
                  <div key={asset.id} className={cn(ROW, COLS, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                    <span className="order-3 flex min-w-0 items-center gap-2.5 text-[13px] font-medium text-zinc-900 md:order-none dark:text-zinc-100">
                      <span className="shrink-0 text-base leading-none">{loc.flag}</span>
                      <span className="truncate">{loc.country}</span>
                      <span className={cn(MUTED, "shrink-0 md:hidden")}>{asset.pegCurrency}</span>
                    </span>
                    <button type="button" onClick={() => cutBy("currency", asset.pegCurrency)} title={`Only ${asset.pegCurrency}`} className={cn(MUTED, "hidden text-left transition-colors md:block hover:text-[#0061E2] md:text-zinc-700 dark:md:text-zinc-300 dark:hover:text-[#5f9dff]")}>
                      {asset.pegCurrency}
                    </button>
                    <span className="order-1 flex min-w-0 items-center gap-2.5 md:order-none">
                      <TokenLogo uri={asset.logo} symbol={asset.symbol} />
                      <span className="min-w-0">
                        {asset.address ? (
                          <Link href={`/explorer/mainnet/c-chain/address/${asset.address}`} className={cn(idInk, "block truncate text-[13px] font-medium underline-offset-4 hover:underline")}>
                            {asset.symbol}
                          </Link>
                        ) : (
                          <span className="block truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{asset.symbol}</span>
                        )}
                        <span className="block truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{asset.name}</span>
                      </span>
                    </span>
                    <button type="button" onClick={() => cutBy("mechanism", asset.mechanism)} title="Only this backing" className="hidden text-left text-[13px] md:block text-zinc-700 transition-colors hover:text-[#0061E2] dark:text-zinc-300 dark:hover:text-[#5f9dff]">
                      {MECHANISM_LABEL[asset.mechanism] ?? asset.mechanism}
                    </button>
                    <span className="hidden min-w-0 truncate text-[13px] md:block">
                      {asset.issuer ? (
                        asset.issuerUrl ? (
                          <a href={asset.issuerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
                            <span className="truncate">{asset.issuer}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                          </a>
                        ) : (
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{asset.issuer}</span>
                        )
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className={cn(MUTED, "hidden text-right md:block")}>{fmtPrice(asset.price) ?? "—"}</span>
                    <span className={cn(INK, "order-2 text-right md:order-none")}>{fmtUsd(asset.mcap)}</span>
                    <span className="hidden text-right md:block">
                      <Pct value={pctChange(asset.mcap, asset.prevDay)} />
                    </span>
                    {/* phones keep the week's move beside the country */}
                    <span className="order-4 text-right md:order-none">
                      <span className="mr-1 font-mono text-[10px] text-zinc-400 md:hidden dark:text-zinc-500">7d</span>
                      <Pct value={pctChange(asset.mcap, asset.prevWeek)} />
                    </span>
                    <span className="hidden text-right md:block">
                      <Pct value={pctChange(asset.mcap, asset.prevMonth)} />
                    </span>
                  </div>
                ))}
                {tableRows.length === 0 && <EmptyRow>No stablecoins match this cut</EmptyRow>}
              </div>
            </div>
          </Board>
        </section>
      </div>
    );
  }

  return (
    <EvmShell network="mainnet">
      <div className="mb-8">
        <DefiSwitch on="stablecoins" />
      </div>
      {body}
    </EvmShell>
  );
}
