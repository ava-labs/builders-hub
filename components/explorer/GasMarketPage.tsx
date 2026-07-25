"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, ChartBoard, StatDash } from "@/components/explorer-v2/ui";
import {
  useExplorerTimeRange,
  RANGE_DAYS,
  RANGE_LABEL,
  type ExplorerRange,
} from "@/components/explorer-v2/time-range";
import { squarify, type SquarifyItem } from "@/components/stats/squarify";
import { useContractNames } from "@/lib/sourcify-client";
import type {
  GasDayPoint,
  GasHistoryDays,
  GasMarket,
  GasProtocol,
  GasRangeDays,
} from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";

/* The chain's gas market as one instrument, in depth: what a unit of
   blockspace costs right now (RPC, live), what your transaction costs in
   real money, how the fee moves (percentile bands, hour-of-week
   seasonality), how full blocks run, and who/what is buying the gas.
   The homepage's single "gas price" figure clicks through to here. */

const POLL_MS = 12_000;
export const FEE_HISTORY_BLOCKS = 60;

/* ---------------------------------------------------------------- */
/* live market: eth_feeHistory straight off the chain's public RPC   */
/* ---------------------------------------------------------------- */

interface FeeSnapshot {
  /** latest base fee, wei */
  baseFeeWei: number | null;
  /** per-block gas_used/gas_limit for the last N blocks, 0..1 */
  utilization: number[];
  /** inclusion tip tiers across the window, wei: [p10, p50, p90] medians */
  tipLowWei: number | null;
  tipMidWei: number | null;
  tipFastWei: number | null;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function median(sortedAsc: number[]): number | null {
  if (!sortedAsc.length) return null;
  return sortedAsc[Math.floor(sortedAsc.length / 2)];
}

export function useFeeHistory(rpcUrl: string | undefined): FeeSnapshot {
  const [snap, setSnap] = useState<FeeSnapshot>({
    baseFeeWei: null,
    utilization: [],
    tipLowWei: null,
    tipMidWei: null,
    tipFastWei: null,
  });

  useEffect(() => {
    if (!rpcUrl) return;
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const result = (await rpcCall(rpcUrl, "eth_feeHistory", [
          `0x${FEE_HISTORY_BLOCKS.toString(16)}`,
          "latest",
          [10, 50, 90],
        ])) as {
          baseFeePerGas?: string[];
          gasUsedRatio?: number[];
          reward?: string[][];
        };
        if (cancelled || !result) return;
        const baseFees = (result.baseFeePerGas ?? []).map((h) => parseInt(h, 16));
        const col = (i: number) =>
          (result.reward ?? [])
            .map((r) => parseInt(r?.[i] ?? "0x0", 16))
            .sort((a, b) => a - b);
        setSnap({
          // baseFeePerGas has N+1 entries; the last is the pending block's
          baseFeeWei: baseFees.length ? baseFees[baseFees.length - 1] : null,
          utilization: result.gasUsedRatio ?? [],
          tipLowWei: median(col(0)),
          tipMidWei: median(col(1)),
          tipFastWei: median(col(2)),
        });
      } catch {
        /* the last snapshot stands */
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [rpcUrl]);

  return snap;
}

/* native token USD price, one fetch — the explorer route caches CoinGecko */
/* the chain's USD price via the legacy explorer route's priceOnly mode
   (server-cached, much lighter than the full payload). `settled` separates
   "still loading" from "token isn't listed" — the cost panel holds its
   figures on the former and only falls back to native units on the
   latter, so a price that arrives late never flips an already-painted
   number from AVAX to dollars. */
export function useTokenUsd(evmChainId: number): { usd: number | null; settled: boolean } {
  const [state, setState] = useState<{ usd: number | null; settled: boolean }>({
    usd: null,
    settled: false,
  });
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setState({ usd: null, settled: false });
    fetch(`/api/explorer/${evmChainId}?priceOnly=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { price?: { price?: number } } | null) => {
        if (!cancelled) setState({ usd: data?.price?.price ?? null, settled: true });
      })
      .catch(() => {
        if (!cancelled) setState({ usd: null, settled: true });
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId]);
  return state;
}

/* the page clock's window, in the vocabulary the gas-history feed accepts —
   smallest computed span (7/30/90/365) that covers it */
function historyDays(range: ExplorerRange): GasHistoryDays {
  const d = RANGE_DAYS[range];
  return d <= 7 ? 7 : d <= 30 ? 30 : d <= 90 ? 90 : 365;
}

/* daily fee percentiles + gas volume over a window — the cheap gas-history
   feed the detail sheets read; the top page's clock-driven bands slice it */
export function useGasHistory(evmChainId: number, days: GasHistoryDays) {
  const [daily, setDaily] = useState<GasDayPoint[] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setDaily(null);
    setMissing(false);
    fetch(`/api/gas-history/${evmChainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { daily: GasDayPoint[] }) => {
        if (!cancelled) setDaily(data.daily);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, days]);
  return { daily, missing };
}

/* ---------------------------------------------------------------- */
/* formatting + selector labels                                      */
/* ---------------------------------------------------------------- */

/** wei → the chain's gwei-equivalent, adaptive precision */
export function fmtNano(wei: number): string {
  const nano = wei / 1e9;
  if (nano >= 100) return Math.round(nano).toLocaleString("en-US");
  if (nano >= 1) return nano.toFixed(2);
  return nano.toFixed(3);
}

export function nanoUnit(symbol?: string): string {
  return symbol === "AVAX" ? "nAVAX" : "gwei";
}

export function fmtGas(gas: number): string {
  if (gas >= 1e12) return `${(gas / 1e12).toFixed(2)}T`;
  if (gas >= 1e9) return `${(gas / 1e9).toFixed(2)}B`;
  if (gas >= 1e6) return `${(gas / 1e6).toFixed(1)}M`;
  if (gas >= 1e3) return `${(gas / 1e3).toFixed(1)}K`;
  return String(Math.round(gas));
}

function fmtNative(wei: number): string {
  const v = wei / 1e18;
  if (v >= 0.01) return v.toFixed(3);
  if (v >= 0.0001) return v.toFixed(5);
  return v.toExponential(1);
}

function fmtUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd <= 0) return "$0.00";
  // sub-cent is where these chains live: keep three significant digits,
  // however many zeros that takes, instead of hiding behind "<$0.01"
  const decimals = Math.min(12, Math.ceil(-Math.log10(usd)) + 2);
  return `$${usd.toFixed(decimals).replace(/0$/, "")}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

/* offline fallback for the classics — the API decodes selectors through
   Sourcify's signature database, but these paint even when that lookup
   fails, and "native"/0x00000000 need pinning it can't provide */
const SELECTOR_NAMES: Record<string, string> = {
  native: "Native transfer",
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  "0x095ea7b3": "approve",
  "0xa22cb465": "setApprovalForAll",
  "0x42842e0e": "safeTransferFrom",
  "0xd0e30db0": "deposit",
  "0x2e1a7d4d": "withdraw",
  "0x1249c58b": "mint",
  "0x40c10f19": "mint",
  "0x38ed1739": "swapExactTokensForTokens",
  "0x18cbafe5": "swapExactTokensForETH",
  "0x7ff36ab5": "swapExactETHForTokens",
  "0x04e45aaf": "exactInputSingle",
  "0xc04b8d59": "exactInput",
  "0x5ae401dc": "multicall",
  "0xac9650d8": "multicall",
  "0x00000000": "0x00000000",
};

/* what a transaction costs right now — typical gas of common actions */
const ACTIONS: { label: string; gas: number }[] = [
  { label: "Native Transfer", gas: 21_000 },
  { label: "ERC-20 Transfer", gas: 55_000 },
  { label: "DEX Swap", gas: 165_000 },
  { label: "NFT Mint", gas: 120_000 },
];

/* The statement panel, purely observational — no inputs, no gas jargon:
   ONE hero number (what sending the native token costs, in money, off
   the live market) with the other everyday actions reading quietly
   below. Same hero grammar as the staking panel next door. */
function CostPanel({
  effectiveWei,
  usd,
  usdSettled,
  symbol,
  unit,
}: {
  effectiveWei: number | null;
  usd: number | null;
  usdSettled: boolean;
  symbol: string;
  unit: string;
}) {
  // one money formatter for every figure on the panel — USD when the
  // token is priced, native units otherwise, skeleton while settling
  const price = (gas: number): React.ReactNode => {
    const costWei = effectiveWei !== null ? effectiveWei * gas : null;
    if (costWei === null) return "—";
    if (usd !== null) return fmtUsd((costWei / 1e18) * usd);
    if (!usdSettled)
      return (
        <span
          className="inline-block h-[0.85em] w-16 animate-pulse bg-white/10 align-middle"
          aria-label="Loading price"
        />
      );
    return `${fmtNative(costWei)} ${symbol}`;
  };
  const hero = ACTIONS[0]; // the native transfer — the everyman number
  const heroWei = effectiveWei !== null ? effectiveWei * hero.gas : null;

  return (
    <div className="flex flex-col gap-8 bg-[#1F1F1F] p-6 md:p-8">
      {/* headline left, the ONE number right */}
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
        <h3 className="v2-display text-3xl leading-[1.02] md:text-4xl">
          <span className="block text-[#EBF0FA]">What a transaction</span>
          <span className="block text-[#E6212F]">costs right now.</span>
        </h3>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
            Sending {symbol || "the native token"} · live
          </span>
          <span className="font-mono text-6xl tabular-nums tracking-tight text-[#EBF0FA] md:text-7xl">
            {heroWei !== null && usd !== null ? (
              fmtUsd((heroWei / 1e18) * usd)
            ) : heroWei !== null && !usdSettled ? (
              <span
                className="inline-block h-[0.85em] w-44 animate-pulse bg-white/10 align-middle"
                aria-label="Loading price"
              />
            ) : heroWei !== null ? (
              <>
                {fmtNative(heroWei)}
                <span className="ml-2 text-2xl text-[#A2AFB2]">{symbol}</span>
              </>
            ) : (
              "—"
            )}
          </span>
          {heroWei !== null && usd !== null && (
            <span className="font-mono text-xs tabular-nums text-[#A2AFB2]">
              = {fmtNative(heroWei)} {symbol} · {fmtNano(heroWei)} {unit} total
            </span>
          )}
        </div>
      </div>

      {/* the rest of an everyday session, reading quietly on one rule —
          plain label→figure pairs, no boxes, no dividers */}
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
          {ACTIONS.slice(1).map((a) => (
            <span key={a.label} className="flex items-baseline gap-2.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2AFB2]">
                {a.label}
              </span>
              <span className="font-mono text-xl tabular-nums tracking-tight text-[#EBF0FA] md:text-2xl">
                {price(a.gas)}
              </span>
            </span>
          ))}
        </div>
        {usd !== null && (
          <span className="font-mono text-[11px] text-[#A2AFB2]/80">
            {symbol} at ${usd.toFixed(2)} · base fee + median priority tip
          </span>
        )}
      </div>
    </div>
  );
}

/* the shared tooltip chrome — same plate PchainHome's charts wear */
export function TipPlate({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {children}
    </div>
  );
}

export function GasStat({ label, live = false, children, sub, href }: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
  sub?: React.ReactNode;
  /** the stat's detail sheet — makes the cell a door, with the shared
   *  hover affordance every clickable figure on the explorer wears */
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
          </span>
        )}
        {label}
        {href && (
          <ArrowRight className="h-3 w-3 -translate-x-0.5 text-[#E6212F] opacity-0 transition-all group-hover/door:translate-x-0 group-hover/door:opacity-100" />
        )}
      </span>
      <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
        {children}
      </span>
      {sub && <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{sub}</span>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group/door flex flex-col gap-1.5 px-5 py-5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
      >
        {body}
      </Link>
    );
  }
  return <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">{body}</div>;
}

/* percentile band + median line, shared by the 48h and 60d fee charts.
   The band is drawn as a transparent p25 floor with (p75−p25) stacked on
   it — recharts' way of shading between two series. The detail sheets set
   `detailed` for the full instrument: taller plot, gridlines, real axes. */
export function FeeBandChart<T extends { p25: number; p50: number; p75: number; p95: number }>({
  data,
  unit,
  labelFor,
  detailed = false,
  xTick,
}: {
  data: T[];
  unit: string;
  labelFor: (d: T) => string;
  detailed?: boolean;
  /** detailed mode's x-axis label for a row (short form, e.g. "Jul 12") */
  xTick?: (d: T) => string;
}) {
  const shaped = useMemo(
    () => data.map((d) => ({ ...d, band: Math.max(0, d.p75 - d.p25), xLabel: xTick?.(d) ?? "" })),
    [data, xTick],
  );
  return (
    <div className={cn("text-zinc-900 dark:text-zinc-100", detailed ? "h-full" : "h-40")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={shaped}>
          {detailed && (
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-zinc-200 dark:stroke-zinc-800" />
          )}
          {detailed && (
            <XAxis
              dataKey="xLabel"
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
            />
          )}
          <YAxis
            hide={!detailed}
            domain={[0, "dataMax"]}
            width={detailed ? 48 : undefined}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
          />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as T;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{labelFor(d)}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.p50} {unit} median
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    p25–p75 {d.p25}–{d.p75} · p95 {d.p95} {unit}
                  </p>
                </TipPlate>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="p25"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="band"
            stackId="band"
            stroke="none"
            fill="currentColor"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* detailed mode pans: drag the window, drag its edges */}
          {detailed && (
            <Brush
              dataKey="xLabel"
              height={26}
              travellerWidth={8}
              stroke="#A2AFB2"
              fill="rgba(162, 175, 178, 0.06)"
              tickFormatter={() => ""}
            >
              <LineChart>
                <Line type="monotone" dataKey="p50" stroke="#E6212F" strokeWidth={1} dot={false} isAnimationActive={false} />
              </LineChart>
            </Brush>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* hour-of-week seasonality heatmap — when is blockspace cheap?      */
/* ---------------------------------------------------------------- */

export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FeeHeatmap({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.p50]));
  const values = cells.map((c) => c.p50).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-px">
        {/* hour header */}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={`h-${h}`}
            className="pb-1 text-center font-mono text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {h % 6 === 0 ? h : ""}
          </span>
        ))}
        {DOW_LABELS.map((label, i) => {
          const dow = i + 1; // ClickHouse: 1 = Monday
          return (
            <FragmentRow key={label} label={label}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = byKey.get(`${dow}-${h}`);
                const t = v === undefined ? null : (v - min) / span;
                return (
                  <span
                    key={h}
                    title={
                      v === undefined
                        ? `${label} ${String(h).padStart(2, "0")}:00 UTC · no data`
                        : `${label} ${String(h).padStart(2, "0")}:00 UTC · median ${v} ${unit}`
                    }
                    className="aspect-square min-h-3"
                    style={{
                      backgroundColor:
                        t === null
                          ? "rgba(161,161,170,0.08)"
                          : `rgba(230, 33, 47, ${(0.05 + 0.75 * t).toFixed(3)})`,
                    }}
                  />
                );
              })}
            </FragmentRow>
          );
        })}
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
        <span>hours UTC</span>
        <span className="flex items-center gap-2">
          cheap {min} {unit}
          <span
            className="h-2 w-24"
            style={{
              background: "linear-gradient(to right, rgba(230,33,47,0.05), rgba(230,33,47,0.8))",
            }}
          />
          {max} {unit} pricey
        </span>
      </div>
    </div>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center pr-2 font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      {children}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* demand decomposition + fullness distribution                      */
/* ---------------------------------------------------------------- */

export function SelectorBars({ selectors }: { selectors: GasMarket["selectors"] }) {
  const total = selectors.reduce((s, x) => s + x.gas, 0);
  const max = selectors[0]?.gas ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      {selectors.map((s) => {
        // local pins win (native, the spam-collided 0x00000000), then the
        // Sourcify-decoded signature; bare name in the column, full
        // signature in the tooltip
        const sig = SELECTOR_NAMES[s.selector] ?? s.name;
        const name = sig?.split("(")[0];
        return (
          <div key={s.selector} className="grid grid-cols-[11rem_minmax(0,1fr)_7rem] items-center gap-3">
            <span
              className="truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
              title={sig ? `${sig} · ${s.selector}` : s.selector}
            >
              {name ?? s.selector}
            </span>
            <span className="h-3.5 bg-zinc-100 dark:bg-zinc-900">
              <span
                className="block h-full bg-[#E6212F]/70"
                style={{ width: `${Math.max(1, (s.gas / max) * 100)}%` }}
              />
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {((s.gas / total) * 100).toFixed(1)}% · {fmtGas(s.gas)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function UtilHistogram({ histogram }: { histogram: GasMarket["histogram"] }) {
  const totalBlocks = histogram.reduce((s, b) => s + b.blocks, 0);
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={histogram} barCategoryGap="14%">
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as GasMarket["histogram"][number];
              return (
                <TipPlate>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.bucket} full
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.blocks.toLocaleString()} blocks ·{" "}
                    {totalBlocks ? ((d.blocks / totalBlocks) * 100).toFixed(1) : 0}%
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="blocks" fill="#A2AFB2" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-7 pt-1">
        {histogram.map((b) => (
          <span
            key={b.bucket}
            className="text-center font-mono text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {b.bucket}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* the blockspace-buyers treemap — squarify over protocol groups     */
/* ---------------------------------------------------------------- */

interface ProtocolItem extends SquarifyItem {
  p: GasProtocol;
}

/* display name: registry protocol, else sourcify name, else short addr */
function protocolLabel(p: GasProtocol, names: Map<string, string>): string {
  if (!p.address) return p.name;
  return names.get(p.address.toLowerCase()) ?? shortAddr(p.address);
}

function protocolHref(p: GasProtocol, base: string): string | null {
  if (p.slug) return `/stats/dapps/${p.slug}`;
  if (p.address) return `${base}/address/${p.address}`;
  return null;
}

export function ProtocolsTreemap({
  protocols,
  names,
  base,
  linkless = false,
}: {
  protocols: GasProtocol[];
  names: Map<string, string>;
  base: string;
  /** plain tiles — for when the treemap itself sits inside a door (a
   *  link can't nest links); the demand sheet keeps the linked tiles */
  linkless?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rects = useMemo(() => {
    if (!size.w || !size.h) return [];
    const items: ProtocolItem[] = protocols
      .filter((p) => p.gas > 0)
      .map((p) => ({ key: p.key, value: p.gas, p }));
    return squarify(items, 0, 0, size.w, size.h);
  }, [protocols, size.w, size.h]);

  const maxGas = protocols[0]?.gas ?? 1;

  return (
    <div ref={ref} className="relative h-72 w-full md:h-80">
      {rects.map(({ item, x, y, w, h }) => {
        const p = item.p;
        const label = protocolLabel(p, names);
        const href = linkless ? null : protocolHref(p, base);
        // text tiers by what actually fits: name at 44px, +share at 60px,
        // +gas caption at 76px — a tile never guillotines its own caption
        const showText = w > 90 && h > 44;
        const showShare = h > 60;
        const showGas = h > 76;
        const title = `${label}${p.category ? ` · ${p.category}` : ""} · ${fmtGas(p.gas)} gas (${p.sharePct.toFixed(1)}%) · ${p.txs.toLocaleString()} txs`;
        const style = {
          left: x,
          top: y,
          width: w,
          height: h,
          // magnitude rides a single-hue ramp — the brand red at
          // burn-appropriate opacity, deepest for the biggest buyer
          backgroundColor: `rgba(230, 33, 47, ${(0.07 + 0.3 * (p.gas / maxGas)).toFixed(3)})`,
        };
        const body = showText && (
          <span className="flex h-full flex-col justify-between p-2.5">
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                {label}
              </span>
              {showShare && (
                <span className="block truncate font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {p.sharePct.toFixed(1)}%{p.category ? ` · ${p.category}` : ""}
                </span>
              )}
            </span>
            {showGas && (
              <span className="font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {fmtGas(p.gas)} gas
              </span>
            )}
          </span>
        );
        const tileClass = cn(
          "group absolute overflow-hidden border border-white outline-none transition-[filter] dark:border-zinc-950",
          // linkless tiles sit inside a door — the whole card is the click,
          // so per-tile brightening would falsely imply per-tile links
          !linkless && "hover:brightness-95 dark:hover:brightness-125",
        );
        return href ? (
          <Link key={item.key} href={href} title={title} className={tileClass} style={style}>
            {body}
          </Link>
        ) : (
          <span key={item.key} title={title} className={tileClass} style={style}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/* the treemap's table twin — every figure the tiles can't fit */
export function ProtocolTable({
  protocols,
  names,
  base,
  symbol,
}: {
  protocols: GasProtocol[];
  names: Map<string, string>;
  base: string;
  symbol: string;
}) {
  return (
    <table className="w-full min-w-[46rem] table-fixed border-collapse">
      <thead>
        {/* proportional widths: table-fixed would otherwise hand every
            spare pixel to the one unsized column and strand the numbers
            against the right edge */}
        <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
          <th className={cn(PTH, "w-[30%]")}>Buyer</th>
          <th className={cn(PTH, "w-[14%]")}>Category</th>
          <th className={cn(PTH, "w-[10%] text-right")}>Gas Share</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Txs</th>
          <th className={cn(PTH, "w-[10%] text-right")}>Senders</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Fees ({symbol})</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Δ prev</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {protocols.map((p) => {
          const label = protocolLabel(p, names);
          const href = protocolHref(p, base);
          return (
            <tr key={p.key}>
              <td className={cn(PTD, "truncate")}>
                {href ? (
                  <Link
                    href={href}
                    className="font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                )}
              </td>
              <td className={cn(PTD, "font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400")}>
                {p.category ?? "—"}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300")}>
                {p.sharePct.toFixed(1)}%
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.txs.toLocaleString()}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.senders.toLocaleString()}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.feesAvax.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td
                className={cn(
                  PTD,
                  "text-right font-mono tabular-nums",
                  p.deltaPct === null
                    ? "text-zinc-400 dark:text-zinc-500"
                    : p.deltaPct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#E6212F]",
                )}
              >
                {p.deltaPct === null
                  ? "—"
                  : `${p.deltaPct >= 0 ? "+" : ""}${p.deltaPct.toFixed(0)}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const PTH =
  "px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const PTD = "px-5 py-3 text-[13px] md:px-6";

/* ---------------------------------------------------------------- */
/* the page body                                                     */
/* ---------------------------------------------------------------- */

export function GasMarketContent({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const symbol = catalog.networkToken?.symbol ?? "";
  const unit = nanoUnit(symbol);
  const fee = useFeeHistory(catalog.rpcUrl);
  const { usd, settled: usdSettled } = useTokenUsd(evmChainId);

  // the page-level clock in the subnav drives the demand window; calling
  // the hook unconditionally registers this page as a consumer, which is
  // what makes the subnav's range control appear
  const range = useExplorerTimeRange();
  // the clock offers up to a year, but 90d is the longest gas window the
  // route computes reliably (a full 365d raw_txs scan blows the query
  // budget) — clamp the year view to 90d and label it honestly below
  const rangeDays = Math.min(RANGE_DAYS[range], 90) as GasRangeDays;

  const [market, setMarket] = useState<GasMarket | null>(null);
  const [marketMissing, setMarketMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    fetch(`/api/gas-market/${evmChainId}?range=${rangeDays}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: GasMarket) => {
        if (!cancelled) setMarket(data);
      })
      .catch(() => {
        if (!cancelled) setMarketMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, rangeDays]);

  // a range switch keeps the last payload on screen, dimmed, until the
  // new one lands — same idiom as the P-Chain tx list
  const rangeStale = market !== null && market.rangeDays !== rangeDays;

  // the clock-driven daily feed behind the base-fee band and gas bars — the
  // top page's only fixed-window charts otherwise, now on the page clock
  const { daily: history, missing: historyMissing } = useGasHistory(evmChainId, historyDays(range));
  const isHourly = range === "day";
  // the window's daily rows for every range but day, which keeps its live
  // hourly band; the gas bars fall back to 7 days on day (a 1-bar chart says
  // nothing) and label that exception
  const windowedDaily = useMemo(() => (history ?? []).slice(-RANGE_DAYS[range]), [history, range]);
  const gasBars = isHourly ? history ?? [] : windowedDaily;

  const unknownAddresses = useMemo(
    () => market?.protocols.flatMap((p) => (p.address ? [p.address] : [])) ?? [],
    [market],
  );
  const names = useContractNames(evmChainId, unknownAddresses);

  // last-60-block utilization, shaped for the bar strip
  const utilData = fee.utilization.map((u, i) => ({ i, pct: u * 100 }));
  const avgUtil = fee.utilization.length
    ? (fee.utilization.reduce((s, u) => s + u, 0) / fee.utilization.length) * 100
    : null;

  const gas24h = useMemo(() => {
    if (!market?.hourly.length) return null;
    return market.hourly.slice(-24).reduce((s, h) => s + h.gas, 0);
  }, [market]);

  const revertedPct =
    market?.reverted && market.reverted.gas > 0
      ? (market.reverted.revertedGas / market.reverted.gas) * 100
      : null;

  // gas-unit price a normal sender pays right now: base fee + median tip
  const effectiveWei =
    fee.baseFeeWei !== null ? fee.baseFeeWei + (fee.tipMidWei ?? 0) : null;

  const protocolsTotalGas = market?.protocols.reduce((s, p) => s + p.gas, 0) ?? 0;
  const protocolsCoveragePct =
    market && market.rangeTotalGas > 0
      ? Math.min(100, (protocolsTotalGas / market.rangeTotalGas) * 100)
      : null;

  return (
    <div className="flex flex-col gap-10">
      {/* the answer first: what a transaction costs, in money — in the
          homepage pillar panels' voice (#1F1F1F board, EBF0FA lead over
          the E6212F punch, steel spec labels) */}
      <section className="flex flex-col gap-3">
        <CostPanel
          effectiveWei={effectiveWei}
          usd={usd}
          usdSettled={usdSettled}
          symbol={symbol}
          unit={unit}
        />
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Priced at the live base fee plus the median priority tip, using typical gas for each
          action. Actual costs vary by contract.
        </p>
      </section>

      {/* the market underneath those prices — straight off the RPC */}
      <section className="flex flex-col gap-4">
        <Board divide={false} className="border">
          <BoardHeader
            label="Gas Market"
            display
            action={
              <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
                </span>
                Live
              </span>
            }
          />
          <div className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800">
            <GasStat label="Base Fee" live href={`${base}/gas/base-fee`}>
              {fee.baseFeeWei !== null ? (
                <>
                  {fmtNano(fee.baseFeeWei)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
                </>
              ) : (
                <StatDash />
              )}
            </GasStat>
            <GasStat
              label="Utilization"
              sub={`last ${FEE_HISTORY_BLOCKS} blocks`}
              href={`${base}/gas/utilization`}
            >
              {avgUtil !== null ? (
                <>
                  {avgUtil.toFixed(1)}
                  <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
                </>
              ) : (
                <StatDash />
              )}
            </GasStat>
            <GasStat
              label="Gas Used · 24h"
              sub={
                range === "day" && revertedPct !== null
                  ? `${revertedPct.toFixed(1)}% spent by reverted txs`
                  : undefined
              }
            >
              {gas24h !== null ? fmtGas(gas24h) : <StatDash />}
            </GasStat>
          </div>
        </Board>
      </section>

      {/* recent market: hourly base fee band beside block-by-block
          utilization. Every chart card is a door into its stat's detail
          sheet — the outline and sliding arrow say so. */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          // day keeps the live hourly band (the one thing that doesn't follow
          // the clock, so it's labeled); every other range shows the daily
          // percentile band windowed by the clock, unlabeled
          label={isHourly ? "Base Fee · hourly" : "Base Fee"}
          action={<BandKey unit={unit} />}
          href={`${base}/gas/base-fee`}
        >
          {isHourly ? (
            market?.hourly.length ? (
              <FeeBandChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )
          ) : windowedDaily.length ? (
            <FeeBandChart data={windowedDaily} unit={unit} labelFor={(d) => d.d} />
          ) : (
            <HistoryEmpty missing={historyMissing} />
          )}
        </ChartBoard>

        <ChartBoard
          label={`Block Utilization · last ${FEE_HISTORY_BLOCKS} blocks`}
          href={`${base}/gas/utilization`}
          action={
            avgUtil !== null ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                avg {avgUtil.toFixed(1)}%
              </span>
            ) : undefined
          }
        >
          {utilData.length ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilData} barCategoryGap="12%">
                  {/* percent axis pinned to 0–100: a quiet chain must look quiet */}
                  <YAxis hide domain={[0, 100]} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(161,161,170,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { i: number; pct: number };
                      return (
                        <TipPlate>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {d.pct.toFixed(1)}% full
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            {d.i - utilData.length + 1 === 0 ? "latest block" : `${utilData.length - 1 - d.i} blocks ago`}
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Bar dataKey="pct" fill="#A2AFB2" minPointSize={1} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="flex h-40 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              Waiting for RPC…
            </p>
          )}
        </ChartBoard>
      </div>

      {/* the longer record beside the demand mix — one row, two doors.
          The 60-day fee band lives on the base-fee sheet; repeating it
          here said nothing the 48h band and the sheet don't. */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard
          // gas bars follow the clock; day would be a single bar, so it shows
          // the last 7 days and labels that one exception
          label={isHourly ? "Gas Used · 7 days" : "Gas Used"}
          href={`${base}/gas/utilization`}
        >
          {gasBars.length ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gasBars} barCategoryGap="18%">
                  <YAxis hide domain={[0, "dataMax"]} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(161,161,170,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as GasDayPoint;
                      return (
                        <TipPlate>
                          <p className="text-[10px] text-zinc-500">{d.d}</p>
                          <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {fmtGas(d.gas)} gas
                          </p>
                          <p className="text-[10px] tabular-nums text-zinc-500">
                            {d.utilPct.toFixed(1)}% avg utilization · {d.blocks.toLocaleString()} blocks
                          </p>
                        </TipPlate>
                      );
                    }}
                  />
                  <Bar dataKey="gas" fill="#A2AFB2" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <HistoryEmpty missing={historyMissing} />
          )}
        </ChartBoard>

        {/* demand mix — doors into the demand sheet with the treemap;
            the window is the page clock's, unlabeled */}
        <ChartBoard
          className={cn(rangeStale && "opacity-60 transition-opacity")}
          label="By Method"
          href={`${base}/gas/demand`}
          action={
            market?.reverted ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {market.reverted.txs.toLocaleString()} txs
              </span>
            ) : undefined
          }
        >
          {market?.selectors.length ? (
            <SelectorBars selectors={market.selectors} />
          ) : (
            <HistoryEmpty missing={marketMissing} />
          )}
        </ChartBoard>
      </div>

      {/* seasonality: when is blockspace cheap? */}
      {market && market.heatmap.length > 0 && (
        <ChartBoard
          label="Fee Seasonality · median base fee by hour of week"
          href={`${base}/gas/fee-seasonality`}
        >
          <FeeHeatmap cells={market.heatmap} unit={unit} />
        </ChartBoard>
      )}

      {/* who's buying the blockspace — the /stats/dapps/treemap successor.
          The whole map doors into the demand sheet, where the tiles link
          out individually and the table carries the figures. */}
      {market && market.protocols.length > 0 && (
        <ChartBoard
          className={cn(rangeStale && "opacity-60 transition-opacity")}
          label="Where the Gas Goes"
          href={`${base}/gas/demand`}
          bodyClassName="p-2"
          action={
            protocolsCoveragePct !== null ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {protocolsCoveragePct.toFixed(0)}% of {fmtGas(market.rangeTotalGas)} gas
              </span>
            ) : undefined
          }
        >
          <ProtocolsTreemap protocols={market.protocols} names={names} base={base} linkless />
        </ChartBoard>
      )}
    </div>
  );
}

/* legend chip for the band charts — the one place identity needs naming */
export function BandKey({ unit }: { unit: string }) {
  return (
    <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-zinc-900 dark:bg-zinc-100" /> median
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-zinc-900/10 dark:bg-zinc-100/10" /> p25–p75
      </span>
      <span className="sr-only">{unit}</span>
    </span>
  );
}

export function HistoryEmpty({ missing }: { missing: boolean }) {
  return (
    <p className="flex h-40 items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
      {missing ? "No gas history indexed for this chain yet" : "Loading history…"}
    </p>
  );
}
