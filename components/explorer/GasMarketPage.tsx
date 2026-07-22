"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, SectionHeader, StatDash } from "@/components/explorer-v2/ui";
import { squarify, type SquarifyItem } from "@/components/stats/squarify";
import { useContractNames } from "@/lib/sourcify-client";
import type { GasMarket, GasProtocol, GasRangeDays } from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";

/* The chain's gas market as one instrument, in depth: what a unit of
   blockspace costs right now (RPC, live), what your transaction costs in
   real money, how the fee moves (percentile bands, hour-of-week
   seasonality), how full blocks run, and who/what is buying the gas.
   The homepage's single "gas price" figure clicks through to here. */

const POLL_MS = 12_000;
const FEE_HISTORY_BLOCKS = 60;

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

function useFeeHistory(rpcUrl: string | undefined): FeeSnapshot {
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
function useTokenUsd(evmChainId: number): number | null {
  const [usd, setUsd] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    fetch(`/api/explorer/${evmChainId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { price?: { price?: number } } | null) => {
        if (!cancelled && data?.price?.price) setUsd(data.price.price);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [evmChainId]);
  return usd;
}

/* ---------------------------------------------------------------- */
/* formatting + selector labels                                      */
/* ---------------------------------------------------------------- */

/** wei → the chain's gwei-equivalent, adaptive precision */
function fmtNano(wei: number): string {
  const nano = wei / 1e9;
  if (nano >= 100) return Math.round(nano).toLocaleString("en-US");
  if (nano >= 1) return nano.toFixed(2);
  return nano.toFixed(3);
}

function nanoUnit(symbol?: string): string {
  return symbol === "AVAX" ? "nAVAX" : "gwei";
}

function fmtGas(gas: number): string {
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
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

/* canonical 4-byte selectors — enough to name the classics; app-specific
   selectors stay as hex and still rank */
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

const RANGE_LABEL: Record<GasRangeDays, string> = {
  1: "24 hours",
  7: "7 days",
  30: "30 days",
};

/* the demand window switch — same segmented-control idiom as the
   Mainnet/Fuji toggle on the chains directory */
function RangeToggle({
  value,
  onChange,
}: {
  value: GasRangeDays;
  onChange: (v: GasRangeDays) => void;
}) {
  return (
    <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
      {([1, 7, 30] as GasRangeDays[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            r === value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {r === 1 ? "24H" : `${r}D`}
        </button>
      ))}
    </div>
  );
}

/* the shared tooltip chrome — same plate PchainHome's charts wear */
function TipPlate({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {children}
    </div>
  );
}

function GasStat({ label, live = false, children, sub }: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
          </span>
        )}
        {label}
      </span>
      <span className="min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
        {children}
      </span>
      {sub && <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{sub}</span>}
    </div>
  );
}

/* percentile band + median line, shared by the 48h and 60d fee charts.
   The band is drawn as a transparent p25 floor with (p75−p25) stacked on
   it — recharts' way of shading between two series. */
function FeeBandChart<T extends { p25: number; p50: number; p75: number; p95: number }>({
  data,
  unit,
  labelFor,
}: {
  data: T[];
  unit: string;
  labelFor: (d: T) => string;
}) {
  const shaped = useMemo(
    () => data.map((d) => ({ ...d, band: Math.max(0, d.p75 - d.p25) })),
    [data],
  );
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={shaped}>
          <YAxis hide domain={[0, "dataMax"]} />
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
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* hour-of-week seasonality heatmap — when is blockspace cheap?      */
/* ---------------------------------------------------------------- */

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function FeeHeatmap({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
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

function SelectorBars({ selectors }: { selectors: GasMarket["selectors"] }) {
  const total = selectors.reduce((s, x) => s + x.gas, 0);
  const max = selectors[0]?.gas ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      {selectors.map((s) => {
        const name = SELECTOR_NAMES[s.selector];
        return (
          <div key={s.selector} className="grid grid-cols-[11rem_minmax(0,1fr)_7rem] items-center gap-3">
            <span
              className="truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
              title={name ? `${name} (${s.selector})` : s.selector}
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

function UtilHistogram({ histogram }: { histogram: GasMarket["histogram"] }) {
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

function ProtocolsTreemap({
  protocols,
  names,
  base,
}: {
  protocols: GasProtocol[];
  names: Map<string, string>;
  base: string;
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
        const href = protocolHref(p, base);
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
        const tileClass =
          "group absolute overflow-hidden border border-white outline-none transition-[filter] hover:brightness-95 dark:border-zinc-950 dark:hover:brightness-125";
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
function ProtocolTable({
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
        <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
          <th className={PTH}>Buyer</th>
          <th className={cn(PTH, "w-28")}>Category</th>
          <th className={cn(PTH, "w-24 text-right")}>Gas Share</th>
          <th className={cn(PTH, "w-24 text-right")}>Txs</th>
          <th className={cn(PTH, "w-24 text-right")}>Senders</th>
          <th className={cn(PTH, "w-28 text-right")}>Fees ({symbol})</th>
          <th className={cn(PTH, "w-24 text-right")}>Δ prev</th>
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
  const usd = useTokenUsd(evmChainId);

  const [range, setRange] = useState<GasRangeDays>(1);
  const [market, setMarket] = useState<GasMarket | null>(null);
  const [marketMissing, setMarketMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    fetch(`/api/gas-market/${evmChainId}?range=${range}`)
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
  }, [evmChainId, range]);

  // a range switch keeps the last payload on screen, dimmed, until the
  // new one lands — same idiom as the P-Chain tx list
  const rangeStale = market !== null && market.rangeDays !== range;
  const rangeLabel = RANGE_LABEL[range];

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
      {/* the market right now — straight off the RPC */}
      <section className="flex flex-col gap-4">
        <Board divide={false}>
          <BoardHeader
            label="Gas Market"
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
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            <GasStat label="Base Fee" live>
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
              label="Priority Tip · median"
              sub={
                fee.tipLowWei !== null && fee.tipFastWei !== null
                  ? `low ${fmtNano(fee.tipLowWei)} · fast ${fmtNano(fee.tipFastWei)}`
                  : `last ${FEE_HISTORY_BLOCKS} blocks`
              }
            >
              {fee.tipMidWei !== null ? (
                <>
                  {fmtNano(fee.tipMidWei)}
                  <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
                </>
              ) : (
                <StatDash />
              )}
            </GasStat>
            <GasStat label="Utilization" sub={`last ${FEE_HISTORY_BLOCKS} blocks`}>
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
                range === 1 && revertedPct !== null
                  ? `${revertedPct.toFixed(1)}% spent by reverted txs`
                  : undefined
              }
            >
              {gas24h !== null ? fmtGas(gas24h) : <StatDash />}
            </GasStat>
          </div>
        </Board>
      </section>

      {/* what that means in money — priced at base + median tip */}
      <section className="flex flex-col gap-4">
        <Board divide={false}>
          <BoardHeader
            label="What a Transaction Costs Right Now"
            action={
              usd !== null ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {symbol} at ${usd.toFixed(2)}
                </span>
              ) : undefined
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
            {ACTIONS.map((a) => {
              const costWei = effectiveWei !== null ? effectiveWei * a.gas : null;
              return (
                <GasStat
                  key={a.label}
                  label={a.label}
                  sub={
                    costWei !== null
                      ? `${fmtNative(costWei)} ${symbol} · ${fmtGas(a.gas)} gas`
                      : `${fmtGas(a.gas)} gas typical`
                  }
                >
                  {costWei !== null && usd !== null ? (
                    fmtUsd((costWei / 1e18) * usd)
                  ) : costWei !== null ? (
                    `${fmtNative(costWei)} ${symbol}`
                  ) : (
                    <StatDash />
                  )}
                </GasStat>
              );
            })}
          </div>
        </Board>
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          Priced at the live base fee plus the median priority tip, using typical gas for each
          action. Actual usage varies by contract.
        </p>
      </section>

      {/* recent market: hourly base fee band beside block-by-block utilization */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Base Fee · last 48 hours"
            action={<BandKey unit={unit} />}
          />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {market?.hourly.length ? (
              <FeeBandChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )}
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader
            label={`Block Utilization · last ${FEE_HISTORY_BLOCKS} blocks`}
            action={
              avgUtil !== null ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  avg {avgUtil.toFixed(1)}%
                </span>
              ) : undefined
            }
          />
          <Board divide={false} className="px-5 py-5 md:px-6">
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
          </Board>
        </section>
      </div>

      {/* the longer record */}
      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Base Fee · 60 days" action={<BandKey unit={unit} />} />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {market?.daily.length ? (
              <FeeBandChart data={market.daily} unit={unit} labelFor={(d) => d.d} />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )}
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader label="Gas Used · 60 days" />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {market?.daily.length ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={market.daily} barCategoryGap="18%">
                    <YAxis hide domain={[0, "dataMax"]} />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(161,161,170,0.08)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as GasMarket["daily"][number];
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
              <HistoryEmpty missing={marketMissing} />
            )}
          </Board>
        </section>
      </div>

      {/* demand: who and what buys the blockspace, over a chosen window */}
      <section className="flex flex-col gap-4">
        <SectionHeader label={`Demand · last ${rangeLabel}`} action={<RangeToggle value={range} onChange={setRange} />} />
        <div
          className={cn(
            "grid items-start gap-x-8 gap-y-10 lg:grid-cols-2",
            rangeStale && "opacity-60 transition-opacity",
          )}
        >
          <div className="flex flex-col gap-4">
            <SectionHeader
              label="By Method"
              action={
                market?.reverted ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {market.reverted.txs.toLocaleString()} txs
                  </span>
                ) : undefined
              }
            />
            <Board divide={false} className="px-5 py-5 md:px-6">
              {market?.selectors.length ? (
                <SelectorBars selectors={market.selectors} />
              ) : (
                <HistoryEmpty missing={marketMissing} />
              )}
            </Board>
            {market?.reverted && revertedPct !== null && (
              <p className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                Wasted gas: {fmtGas(market.reverted.revertedGas)} ({revertedPct.toFixed(1)}% of the
                window&apos;s total) went to {market.reverted.revertedTxs.toLocaleString()} reverted
                transactions — reverts still pay for the gas they consume.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <SectionHeader label="Block Fullness Distribution" />
            <Board divide={false} className="px-5 py-5 md:px-6">
              {market?.histogram.length ? (
                <UtilHistogram histogram={market.histogram} />
              ) : (
                <HistoryEmpty missing={marketMissing} />
              )}
            </Board>
          </div>
        </div>
      </section>

      {/* seasonality: when is blockspace cheap? */}
      {market && market.heatmap.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Fee Seasonality · median base fee by hour, 30 days"
          />
          <Board divide={false} className="px-5 py-5 md:px-6">
            <FeeHeatmap cells={market.heatmap} unit={unit} />
          </Board>
        </section>
      )}

      {/* who's buying the blockspace — the /stats/dapps/treemap successor:
          protocol attribution via the contract registry over cheap
          windowed queries instead of full-history scans */}
      {market && market.protocols.length > 0 && (
        <section
          className={cn("flex flex-col gap-4", rangeStale && "opacity-60 transition-opacity")}
        >
          <SectionHeader
            label={`Where the Gas Goes · last ${rangeLabel}`}
            action={
              protocolsCoveragePct !== null ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {protocolsCoveragePct.toFixed(0)}% of {fmtGas(market.rangeTotalGas)} gas
                </span>
              ) : undefined
            }
          />
          <Board divide={false} className="p-2">
            <ProtocolsTreemap protocols={market.protocols} names={names} base={base} />
          </Board>
          <Board divide={false} className="overflow-x-auto">
            <ProtocolTable protocols={market.protocols} names={names} base={base} symbol={symbol} />
          </Board>
          <p className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
            Registry-attributed protocols plus the largest unlabelled contracts. Tile area = gas
            share; Δ compares against the preceding {rangeLabel}. Protocols link to their dapp
            page, unlabelled contracts to the address.
          </p>
        </section>
      )}
    </div>
  );
}

/* legend chip for the band charts — the one place identity needs naming */
function BandKey({ unit }: { unit: string }) {
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

function HistoryEmpty({ missing }: { missing: boolean }) {
  return (
    <p className="flex h-40 items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
      {missing ? "No gas history indexed for this chain yet" : "Loading history…"}
    </p>
  );
}
