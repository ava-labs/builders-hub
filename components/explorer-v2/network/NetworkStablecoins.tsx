"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  RANGE_DAYS,
  rangeWindowLabel,
  useExplorerTimeRange,
} from "@/components/explorer-v2/time-range";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import {
  Board,
  BoardHeader,
  ChartBoard,
  StatCell,
  idInk,
} from "@/components/explorer-v2/ui";
import { ChartEmpty } from "@/components/explorer-v2/staking/bits";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";
import { Delta } from "@/components/explorer-v2/evm/metric-charts";
import { StablecoinMap, type CoveredCountry } from "@/components/explorer-v2/network/StablecoinMap";
import { HoverReadout, HoverRow } from "@/components/explorer-v2/network/stablecoin-hover";
import type { StablecoinAsset, StablecoinsApiResponse } from "@/lib/stablecoins";

/* The network scope's stablecoin observatory: every pegged asset issued or
   bridged onto Avalanche, in the gas-page grammar. A lead board headlines
   the market, the history area chart rides the page clock, a dominance
   treemap and per-currency / per-backing ledgers split the market three
   ways, a USD peg watch reads deviations in basis points, and the
   by-country table carries the roster. Supply and prices come from
   DefiLlama through /api/stablecoins; issuers and jurisdictions are the
   curated registry in lib/stablecoins. */

const SHELL_INTRO =
  "Every stablecoin issued or bridged onto Avalanche: market cap, dominance, peg health, and the currencies and countries behind them.";

/* The treemap's categorical slots, one per dominance rank. Both ramps
   passed scripts/validate_palette.js (dataviz skill) against their
   surface at all-pairs CVD separation; everything past rank five wears
   the ledger gray and leans on its direct label. */
const TREEMAP_STYLE = `
.sc-map {
  --sc-0: #C11824; --sc-1: #2456A6; --sc-2: #E09A10; --sc-3: #28ADBF; --sc-4: #8B5CF6;
  --sc-tail: #A2AFB2; --sc-gap: #ffffff;
  --sc-ink-0: #ffffff; --sc-ink-1: #ffffff; --sc-ink-2: #18181b;
  --sc-ink-3: #18181b; --sc-ink-4: #ffffff; --sc-ink-tail: #18181b;
}
.dark .sc-map {
  --sc-0: #C63840; --sc-1: #2D59B5; --sc-2: #BD8118; --sc-3: #17A2B4; --sc-4: #9572F5;
  --sc-tail: #52525B; --sc-gap: #09090b;
  --sc-ink-2: #09090b; --sc-ink-3: #09090b; --sc-ink-tail: #fafafa;
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

/* ---- small parts in the ICM facet's voice ---- */

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

function Figure({ children, suffix }: { children: React.ReactNode; suffix?: React.ReactNode }) {
  return (
    <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
      {children}
      {suffix && <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{suffix}</span>}
    </span>
  );
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

/* one ledger line: lead content, quiet share bar, share %, USD value */
function ShareRow({
  lead,
  usd,
  share,
  className,
}: {
  lead: React.ReactNode;
  usd: number;
  share: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3 md:px-6", className)}>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{lead}</span>
      <span className="hidden h-[3px] w-24 shrink-0 overflow-hidden bg-zinc-100 sm:block dark:bg-zinc-900">
        <span
          className="block h-full bg-[#A2AFB2] dark:bg-zinc-500"
          style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {share.toFixed(1)}%
      </span>
      <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
        {fmtUsd(usd)}
      </span>
    </div>
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
  return (
    <img
      src={uri}
      alt=""
      onError={() => setBroken(true)}
      className="h-5 w-5 shrink-0 rounded-full object-contain"
    />
  );
}

/* legend chip for one stacked band */
function BandKey({ slot, label }: { slot: string; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
      <span className="size-2" style={{ background: `var(--sc-${slot})` }} />
      {label}
    </span>
  );
}

/* signed percent for the table's supply-change cells */
function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-300 dark:text-zinc-700">&mdash;</span>;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        Math.abs(value) < 0.05
          ? "text-zinc-400 dark:text-zinc-500"
          : up
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-[#E6212F]",
      )}
    >
      {up ? "+" : ""}
      {Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}%
    </span>
  );
}

/* peg deviation in basis points, toned by distance from the peg */
function PegBp({ bp }: { bp: number }) {
  const abs = Math.abs(bp);
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums",
        abs <= 30
          ? "text-zinc-500 dark:text-zinc-400"
          : abs <= 100
            ? "text-[#9c7112] dark:text-[#e2b953]"
            : "text-[#c11824] dark:text-[#ff6b73]",
      )}
    >
      {bp >= 0 ? "+" : ""}
      {Math.round(bp)} bp
    </span>
  );
}

/* ---- the dominance treemap ---- */

interface TreemapDatum {
  name: string;
  symbol: string;
  size: number;
  share: number;
  rank: number;
  logo?: string;
}

function TreemapCell(props: Record<string, unknown>) {
  const { x, y, width, height, depth } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
  };
  const datum = props as unknown as TreemapDatum;
  if (depth < 1 || !Number.isFinite(width) || width <= 0 || height <= 0) return null;
  const slot = datum.rank < 5 ? String(datum.rank) : "tail";
  const showLabel = width >= 52 && height >= 36;
  const showShare = width >= 64 && height >= 54;
  // a failed SVG <image> renders nothing (no broken-icon glyph), so the
  // logo needs no fallback state here
  const showLogo = datum.logo && width >= 76;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`var(--sc-${slot})`}
        stroke="var(--sc-gap)"
        strokeWidth={2}
      />
      {showLabel && showLogo && (
        <>
          {/* the CDN flattens icon transparency onto white squares; a
              circular clip turns them into the same coin badges the HTML
              logos get from rounded-full */}
          <clipPath id={`sc-dom-clip-${datum.rank}`}>
            <circle cx={x + 17.5} cy={y + 16.5} r={7.5} />
          </clipPath>
          <image
            href={datum.logo}
            x={x + 10}
            y={y + 9}
            width={15}
            height={15}
            clipPath={`url(#sc-dom-clip-${datum.rank})`}
          />
        </>
      )}
      {showLabel && (
        <text
          x={x + 10 + (showLogo ? 20 : 0)}
          y={y + 20}
          fill={`var(--sc-ink-${slot})`}
          fontSize={12}
          fontWeight={700}
          fontFamily="var(--font-mono, ui-monospace, monospace)"
        >
          {datum.symbol}
        </text>
      )}
      {showShare && (
        <text
          x={x + 10}
          y={y + 37}
          fill={`var(--sc-ink-${slot})`}
          fillOpacity={0.75}
          fontSize={10}
          fontFamily="var(--font-mono, ui-monospace, monospace)"
        >
          {datum.share.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

const TH =
  "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3.5 text-[13px] md:px-6";

/* toggle chip in the TypeFilterRail's grammar */
function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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
      <span
        className={cn("size-1 shrink-0", active ? "bg-current" : "bg-zinc-300 dark:bg-zinc-600")}
        aria-hidden
      />
      {label}
    </button>
  );
}

export function NetworkStablecoins() {
  const range = useExplorerTimeRange();
  const { data, error, retry } = useStablecoins();

  const [groupEU, setGroupEU] = useState(true);
  const [excludeUSD, setExcludeUSD] = useState(false);
  const [query, setQuery] = useState("");

  const assets = data?.assets ?? [];
  const history = data?.history ?? [];

  /* ---- headline readings ---- */

  const totalMcap = useMemo(() => assets.reduce((sum, a) => sum + a.mcap, 0), [assets]);
  const latest = history.length ? history[history.length - 1] : null;

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

  const jurisdictions = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) set.add(rowCountry(a, false).country);
    return set.size;
  }, [assets]);

  const nativeShare = latest && latest.total > 0 ? (latest.minted / latest.total) * 100 : null;

  /* ---- chart + treemap series ---- */

  // one flat row per day: a column per named coin plus the folded tail,
  // in the treemap's rank order so both instruments speak the same colors
  const stackKeys = data?.stack.keys ?? [];
  const capSeries = useMemo(() => {
    const pts = (data?.stack.points ?? []).map((p) => ({
      date: new Date(p.date * 1000).toISOString().slice(0, 10),
      total: p.total,
      other: p.other,
      ...p.coins,
    }));
    return thin(windowSeries(pts, Math.max(7, RANGE_DAYS[range])), 200);
  }, [data, range]);

  const treemapCells = useMemo<TreemapDatum[]>(() => {
    if (!totalMcap) return [];
    const named = assets.filter((a) => a.mcap / totalMcap >= 0.005).slice(0, 9);
    const rest = totalMcap - named.reduce((sum, a) => sum + a.mcap, 0);
    const cells = named.map((a, i) => ({
      name: a.name,
      symbol: a.symbol,
      size: a.mcap,
      share: (a.mcap / totalMcap) * 100,
      rank: i,
      logo: a.logo,
    }));
    if (rest > 0) {
      cells.push({
        name: `${assets.length - named.length} more stablecoins`,
        symbol: "OTHER",
        size: rest,
        share: (rest / totalMcap) * 100,
        rank: 99,
        logo: undefined,
      });
    }
    return cells;
  }, [assets, totalMcap]);

  const backing = useMemo(() => {
    const groups = new Map<string, { usd: number; count: number }>();
    for (const a of assets) {
      const g = groups.get(a.mechanism) ?? { usd: 0, count: 0 };
      g.usd += a.mcap;
      g.count += 1;
      groups.set(a.mechanism, g);
    }
    return [...groups.entries()].sort((x, y) => y[1].usd - x[1].usd);
  }, [assets]);

  // USD tokens with a price feed, read as basis points off the dollar.
  // Feeds more than 20% off peg are stale pools, not depegs (DefiLlama
  // quotes MIM at $0.07): they stay in the table as reported but are
  // excluded here rather than headlining a fake collapse.
  const pegWatch = useMemo(() => {
    return assets
      .filter((a) => a.pegCurrency === "USD" && a.price !== null && a.mcap >= 100_000)
      .map((a) => ({ ...a, bp: (a.price! - 1) * 10_000 }))
      .filter((a) => Math.abs(a.bp) <= 2_000)
      .sort((x, y) => Math.abs(y.bp) - Math.abs(x.bp))
      .slice(0, 8);
  }, [assets]);

  // the map's coverage: currency anchors (every euro country for EUR)
  // plus each curated issuer jurisdiction
  const coverage = useMemo(() => {
    const cov = new Map<string, CoveredCountry>();
    // one asset can reach the same country twice (currency anchor and
    // issuer jurisdiction both United States): count it once per country
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
      if (a.country && COUNTRY_ID[a.country]) {
        add(COUNTRY_ID[a.country], a.country, a.flag ?? "", a);
      }
    }
    return cov;
  }, [assets]);

  /* ---- the by-country table ---- */

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .map((a) => ({ asset: a, loc: rowCountry(a, groupEU) }))
      .filter(({ asset }) => !excludeUSD || asset.pegCurrency !== "USD")
      .filter(
        ({ asset, loc }) =>
          !q ||
          asset.symbol.toLowerCase().includes(q) ||
          asset.name.toLowerCase().includes(q) ||
          asset.pegCurrency.toLowerCase().includes(q) ||
          (asset.issuer ?? "").toLowerCase().includes(q) ||
          loc.country.toLowerCase().includes(q),
      );
  }, [assets, groupEU, excludeUSD, query]);

  /* ---- render ---- */

  let body: React.ReactNode;
  if (!data && !error) {
    body = (
      <div className="flex flex-col gap-10" aria-label="Loading stablecoin data" role="status">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Failed to load stablecoin data
        </p>
        <RetryButton onClick={retry}>Retry</RetryButton>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-10">
        <style>{TREEMAP_STYLE}</style>

        {/* the lead board: the market's four headline readings, and the one
            place the time window is named (the delta follows the clock; the
            roster counts are current-state and say so) */}
        <Board divide={false} className="border">
          <BoardHeader
            label="Stablecoins on Avalanche"
            display
            action={<Chip>{rangeWindowLabel(range)}</Chip>}
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <StatCell label="Market Cap" sub={<Delta value={mcapDelta} />}>
              <Figure>{fmtUsd(totalMcap)}</Figure>
            </StatCell>
            <StatCell
              label="Stablecoins"
              sub={
                assets[0]
                  ? `${assets[0].symbol} leads at ${((assets[0].mcap / totalMcap) * 100).toFixed(1)}%`
                  : undefined
              }
            >
              <Figure>{assets.length}</Figure>
            </StatCell>
            <StatCell label="Currencies" sub={`${jurisdictions} jurisdictions`}>
              <Figure>{currencies.length}</Figure>
            </StatCell>
            <StatCell
              label="Natively Issued"
              sub={latest ? `${fmtUsd(latest.bridged)} bridged in` : undefined}
            >
              {nativeShare !== null ? <Figure>{nativeShare.toFixed(1)}%</Figure> : <Figure>&mdash;</Figure>}
            </StatCell>
          </div>
        </Board>

        {/* the pulse: total circulating value on the page clock, one band
            per top coin in the treemap's rank colors, the rest folded gray */}
        <section className="flex min-w-0 flex-col gap-3">
          <ChartBoard label="Market Cap">
            {capSeries.length ? (
              <div className="sc-map flex flex-col gap-3">
                <div className="h-52 text-zinc-900 dark:text-zinc-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={capSeries}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={[0, "dataMax"]} />
                      <RechartsTooltip
                        cursor={{ stroke: "rgba(161,161,170,0.35)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as Record<string, number> & {
                            date: string;
                          };
                          // one row per live band, largest first, each tied
                          // to its band color; coins not yet issued that day
                          // stay out instead of reading $0
                          const bands = stackKeys
                            .map((k, i) => ({
                              symbol: k.symbol,
                              logo: k.logo,
                              slot: String(i),
                              usd: d[k.id] ?? 0,
                            }))
                            .filter((b) => b.usd > 0)
                            .sort((x, y) => y.usd - x.usd);
                          if (d.other > 0) {
                            bands.push({
                              symbol: "Other",
                              logo: undefined,
                              slot: "tail",
                              usd: d.other,
                            });
                          }
                          return (
                            <HoverReadout label={d.date} value={fmtUsd(d.total)}>
                              {bands.map((b) => (
                                <HoverRow
                                  key={b.symbol}
                                  swatch={`var(--sc-${b.slot})`}
                                  logo={b.logo}
                                  label={b.symbol}
                                  value={fmtUsd(b.usd)}
                                  share={`${d.total > 0 ? ((b.usd / d.total) * 100).toFixed(1) : "0.0"}%`}
                                />
                              ))}
                            </HoverReadout>
                          );
                        }}
                      />
                      {stackKeys.map((k, i) => (
                        <Area
                          key={k.id}
                          stackId="cap"
                          type="monotone"
                          dataKey={k.id}
                          name={k.symbol}
                          stroke="var(--sc-gap)"
                          strokeWidth={1}
                          fill={`var(--sc-${i})`}
                          fillOpacity={0.9}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                      ))}
                      <Area
                        stackId="cap"
                        type="monotone"
                        dataKey="other"
                        name="Other"
                        stroke="var(--sc-gap)"
                        strokeWidth={1}
                        fill="var(--sc-tail)"
                        fillOpacity={0.9}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {stackKeys.map((k, i) => (
                    <BandKey key={k.id} slot={String(i)} label={k.symbol} />
                  ))}
                  <BandKey slot="tail" label="Other" />
                </div>
              </div>
            ) : (
              <ChartEmpty failed={false} label="No history" />
            )}
          </ChartBoard>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Circulating value of every stablecoin on Avalanche, in USD. The five largest coins
            carry their own bands; everything else stacks into Other. Supply data from
            DefiLlama, refreshed every five minutes.
          </p>
        </section>

        {/* how the market splits: dominance by token, then by currency.
            The grid stretches both cells and the treemap fills its board,
            so the pair shares one bottom edge */}
        <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard
            label="Dominance"
            className="flex min-w-0 flex-col"
            bodyClassName="flex flex-1 flex-col"
            action={<Chip>Current</Chip>}
          >
            {treemapCells.length ? (
              <div className="sc-map min-h-72 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapCells}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    isAnimationActive={false}
                    content={<TreemapCell />}
                  >
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as TreemapDatum;
                        return (
                          <HoverReadout label={d.name} value={fmtUsd(d.size)}>
                            <HoverRow
                              swatch={`var(--sc-${d.rank < 5 ? d.rank : "tail"})`}
                              logo={d.logo}
                              label={d.symbol}
                              share={`${d.share.toFixed(1)}%`}
                            />
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

          <ChartBoard
            label="By Currency"
            className="flex min-w-0 flex-col"
            bodyClassName="flex flex-1 flex-col justify-center"
            action={<Chip>{coverage.size} countries</Chip>}
          >
            <div className="flex flex-col gap-4">
              <StablecoinMap coverage={coverage} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                {currencies.map(([code, usd]) => (
                  <span
                    key={code}
                    className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="text-[13px] leading-none">{anchorFlag(code)}</span>
                    {code}
                    <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
                      {fmtUsd(usd)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </ChartBoard>
        </div>

        {/* what stands behind the peg, and how tightly it holds. Three
            backing rows share the peg watch's height, so the pair lands
            on one bottom edge */}
        <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard
            label="Backing"
            bodyClassName="flex flex-1 flex-col p-0"
            className="flex min-w-0 flex-col"
            action={<Chip>Current</Chip>}
          >
            <div className="flex flex-1 flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {backing.map(([mechanism, g]) => (
                <ShareRow
                  key={mechanism}
                  className="flex-1"
                  usd={g.usd}
                  share={totalMcap > 0 ? (g.usd / totalMcap) * 100 : 0}
                  lead={
                    <>
                      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {MECHANISM_LABEL[mechanism] ?? mechanism}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                        {g.count} tokens
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          </ChartBoard>

          <section className="flex min-w-0 flex-col gap-3">
            <ChartBoard
              label="USD Peg Watch"
              bodyClassName="p-0 flex-1"
              className="flex flex-1 flex-col"
              action={<Chip>Current</Chip>}
            >
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pegWatch.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <TokenLogo uri={a.logo} symbol={a.symbol} />
                      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {a.symbol}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                        {fmtUsd(a.mcap)}
                      </span>
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums text-zinc-700 dark:text-zinc-300">
                      {fmtPrice(a.price)}
                    </span>
                    <span className="w-20 shrink-0 text-right">
                      <PegBp bp={a.bp} />
                    </span>
                  </div>
                ))}
                {pegWatch.length === 0 && (
                  <p className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    No price feeds
                  </p>
                )}
              </div>
            </ChartBoard>
          </section>
        </div>
        <p className="-mt-6 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          The peg watch reads distance from the dollar in basis points, largest deviation
          first; tokens under $100k, without a price feed, or whose feed sits more than 20%
          off peg (a stale pool, not a depeg) are excluded. Backing follows DefiLlama&apos;s
          peg-mechanism classification.
        </p>

        {/* the roster: every token, its currency, and where it answers to */}
        <section className="flex min-w-0 flex-col gap-3">
          <ChartBoard
            label="Stablecoins by Country"
            bodyClassName="p-0"
            action={<Chip>{tableRows.length} of {assets.length}</Chip>}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 md:px-6 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <ToggleChip label="Group EU" active={groupEU} onClick={() => setGroupEU((v) => !v)} />
                <ToggleChip
                  label="Exclude USD"
                  active={excludeUSD}
                  onClick={() => setExcludeUSD((v) => !v)}
                />
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tokens"
                  spellCheck={false}
                  className="w-44 border border-zinc-200 bg-transparent py-1.5 pl-9 pr-3 font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                    <th className={TH}>Country</th>
                    <th className={TH}>Currency</th>
                    <th className={TH}>Token</th>
                    <th className={TH}>Backed By</th>
                    <th className={TH}>Issuer</th>
                    <th className={cn(TH, "text-right")}>Price</th>
                    <th className={cn(TH, "text-right")}>Market Cap</th>
                    <th className={cn(TH, "text-right")}>24h</th>
                    <th className={cn(TH, "text-right")}>7d</th>
                    <th className={cn(TH, "text-right")}>30d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {tableRows.map(({ asset, loc }) => (
                    <tr
                      key={asset.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className={TD}>
                        <span className="flex items-center gap-2.5">
                          <span className="shrink-0 text-base leading-none">{loc.flag}</span>
                          <span className="max-w-36 truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {loc.country}
                          </span>
                        </span>
                      </td>
                      <td className={cn(TD, "font-mono text-zinc-700 dark:text-zinc-300")}>
                        {asset.pegCurrency}
                      </td>
                      <td className={TD}>
                        <span className="flex items-center gap-2.5">
                          <TokenLogo uri={asset.logo} symbol={asset.symbol} />
                          <span className="min-w-0">
                            {asset.address ? (
                              <Link
                                href={`/explorer/mainnet/c-chain/address/${asset.address}`}
                                className={cn(
                                  idInk,
                                  "font-medium underline-offset-4 hover:text-[#E6212F] hover:underline",
                                )}
                              >
                                {asset.symbol}
                              </Link>
                            ) : (
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {asset.symbol}
                              </span>
                            )}
                            <span className="block max-w-40 truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                              {asset.name}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={cn(TD, "text-zinc-700 dark:text-zinc-300")}>
                        {MECHANISM_LABEL[asset.mechanism] ?? asset.mechanism}
                      </td>
                      <td className={TD}>
                        {asset.issuer ? (
                          asset.issuerUrl ? (
                            <a
                              href={asset.issuerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-zinc-900 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-100"
                            >
                              {asset.issuer}
                              <ExternalLink className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
                            </a>
                          ) : (
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {asset.issuer}
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">&mdash;</span>
                        )}
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300")}>
                        {fmtPrice(asset.price) ?? <span className="text-zinc-300 dark:text-zinc-700">&mdash;</span>}
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100")}>
                        {fmtUsd(asset.mcap)}
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <Pct value={pctChange(asset.mcap, asset.prevDay)} />
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <Pct value={pctChange(asset.mcap, asset.prevWeek)} />
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <Pct value={pctChange(asset.mcap, asset.prevMonth)} />
                      </td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr>
                      <td className={TD} colSpan={10}>
                        <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
                          No stablecoins match
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartBoard>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Supply changes read against the token&apos;s circulating value 24 hours, 7 days, and
            30 days ago. Issuers and jurisdictions are curated; tokens with a verified contract
            link to their address page. Group EU folds euro-area issuers into one Europe row.
          </p>
        </section>
      </div>
    );
  }

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Stablecoins"
      intro={SHELL_INTRO}
    >
      {body}
    </NetworkShell>
  );
}
