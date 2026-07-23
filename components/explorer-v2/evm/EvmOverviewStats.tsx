"use client";

import { useEffect, useMemo, useState } from "react";
import { Board, BoardHeader, StatCell, StatDash } from "@/components/explorer-v2/ui";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { fmtCompact, num, useChainMetrics } from "./metric-charts";

/* The chain's readings, one uniform grid on the page clock: the live
   market row, then the clock's window with its move against the
   previous window of the same length. Lifetime totals live on their
   subject tabs. Every cell doors into the tab that charts it. */

const METRICS = [
  "activeAddresses",
  "txCount",
  "contracts",
  "gasUsed",
  "feesPaid",
  "avgGasPrice",
].join(",");

interface SeriesPoint {
  timestamp: number;
  value: number | string;
}

interface WindowPair {
  cur: number;
  /** null when the series is too short to hold the previous window */
  prev: number | null;
}

/* the clock's window vs the window before it — sums for volumes,
   means for rates. Needs 2N points for a delta; degrades to cur-only. */
function windowPair(points: SeriesPoint[] | undefined, n: number, mode: "sum" | "avg"): WindowPair | null {
  if (!points || points.length < Math.min(n, 2)) return null;
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const vals = sorted.map((p) => num(p.value as never) ?? 0);
  const take = (arr: number[]) =>
    mode === "sum" ? arr.reduce((s, v) => s + v, 0) : arr.reduce((s, v) => s + v, 0) / arr.length;
  const curSlice = vals.slice(-n);
  if (!curSlice.length) return null;
  const prevSlice = vals.slice(-2 * n, -n);
  return {
    cur: take(curSlice),
    prev: prevSlice.length === n ? take(prevSlice) : null,
  };
}

function pctOf(p: WindowPair | null): number | null {
  if (!p || p.prev === null || p.prev === 0) return null;
  return ((p.cur - p.prev) / p.prev) * 100;
}

/* the move against the previous window, Etherscan's parenthetical */
function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
      {up ? "+" : ""}
      {Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}% vs prev
    </span>
  );
}

/* utilization off the blocks table, windowed on the clock; 404 = not ingested */
function useUtilization(chainId: string, n: number) {
  const days = 2 * n <= 7 ? 7 : 2 * n <= 30 ? 30 : 2 * n <= 90 ? 90 : 365;
  const [pair, setPair] = useState<WindowPair | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPair(null);
    fetch(`/api/gas-history/${chainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { daily?: { utilPct: number }[] } | null) => {
        const d = data?.daily;
        if (cancelled || !d || !d.length) return;
        const avg = (arr: { utilPct: number }[]) => arr.reduce((s, p) => s + p.utilPct, 0) / arr.length;
        const cur = d.slice(-n);
        const prev = d.slice(-2 * n, -n);
        setPair({ cur: avg(cur.length ? cur : d), prev: prev.length === n ? avg(prev) : null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chainId, days, n]);
  return pair;
}

const FIG =
  "min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";

export interface LiveCell {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  live?: boolean;
}

export function EvmOverviewStats({
  chainId,
  base,
  symbol = "AVAX",
  usdPrice,
  liveCells = [],
}: {
  chainId: string;
  base: string;
  symbol?: string;
  /** native token USD price when the token is listed; fees stay native without it */
  usdPrice: number | null;
  /** the live figures (price, block time, latest block …) — same small
   *  cells, first row of the grid */
  liveCells?: LiveCell[];
}) {
  // the page clock: window sums/averages and their vs-prev move all ride it
  const clock = useExplorerTimeRange();
  const n = RANGE_DAYS[clock];
  const windowLabel = RANGE_LABEL[clock];
  // fetch double the window so the previous window is comparable
  const { metrics, failed } = useChainMetrics(chainId, Math.min(n * 2, 365), METRICS);
  const util = useUtilization(chainId, n);

  const m = metrics ?? {};
  const win = (key: string, mode: "sum" | "avg" = "sum") => windowPair(m[key]?.data, n, mode);

  const derived = useMemo(() => {
    const txs = windowPair(m["txCount"]?.data, n, "sum");
    const fees = windowPair(m["feesPaid"]?.data, n, "sum");
    const avgFee =
      fees && txs && txs.cur > 0
        ? {
            cur: fees.cur / txs.cur,
            prev: fees.prev !== null && txs.prev !== null && txs.prev > 0 ? fees.prev / txs.prev : null,
          }
        : null;
    return { avgFee };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, n]);

  if (failed) return null;

  const cell = (
    label: string,
    href: string,
    p: WindowPair | null,
    fmt: (v: number) => React.ReactNode,
    sub?: React.ReactNode,
  ) => (
    <StatCell
      key={label}
      label={label}
      href={href}
      sub={
        p ? (
          <>
            {sub ? <>{sub} · </> : null}
            <Delta value={pctOf(p)} />
          </>
        ) : (
          sub
        )
      }
    >
      {p ? <span className={FIG}>{fmt(p.cur)}</span> : metrics ? <StatDash /> : <span className={FIG}>…</span>}
    </StatCell>
  );

  const grid =
    "grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800";
  const rowRule = "border-b border-zinc-200 dark:border-zinc-800";

  return (
    <Board divide={false} className="border">
      {/* the window is stated once, up here — cells only carry a label
          when they DON'T follow it (· Total, the live row, 24h subs) */}
      <BoardHeader
        label="Chain Stats"
        display
        action={
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            Last {windowLabel}
          </span>
        }
      />
      {/* right now — the live market row */}
      {liveCells.length > 0 && (
        <div className={`${grid} ${rowRule}`}>
          {liveCells.map((c) => (
            <StatCell key={c.label} label={c.label} href={c.href} sub={c.sub} live={c.live}>
              <span className={FIG}>{c.value}</span>
            </StatCell>
          ))}
        </div>
      )}
      {/* the clock's window, against the window before it */}
      <div className={`${grid} ${rowRule}`}>
        {cell(`Transactions`, `${base}/txs`, win("txCount"), fmtCompact)}
        {cell(
          `Active Addresses`,
          `${base}/accounts`,
          win("activeAddresses", "avg"),
          fmtCompact,
          n > 1 ? "daily avg" : undefined,
        )}
        {cell(
          `Contracts Deployed`,
          `${base}/accounts`,
          win("contracts"),
          fmtCompact,
        )}
        {cell(`Gas Used`, `${base}/gas`, win("gasUsed"), fmtCompact)}
      </div>
      <div className={grid}>
        {cell(
          // the C-Chain burns every fee; sovereign L1s choose their own
          // fee destination, so the generic label stays honest there
          chainId === "43114" ? `Fees Burned` : `Fees Paid`,
          `${base}/gas`,
          win("feesPaid"),
          (v) => `${fmtCompact(v)} ${symbol}`,
          usdPrice !== null && win("feesPaid") ? `$${fmtCompact(win("feesPaid")!.cur * usdPrice)}` : undefined,
        )}
        {cell(
          `Avg Tx Fee`,
          `${base}/gas`,
          derived.avgFee,
          (v) => (usdPrice !== null ? `$${(v * usdPrice).toFixed(4)}` : `${v.toFixed(5)} ${symbol}`),
          usdPrice !== null && derived.avgFee ? `${derived.avgFee.cur.toFixed(5)} ${symbol}` : undefined,
        )}
        {cell(`Avg Gas Price`, `${base}/gas/base-fee`, win("avgGasPrice", "avg"), (v) =>
          `${v.toFixed(2)} n${symbol}`,
        )}
        {cell(`Utilization`, `${base}/gas/utilization`, util, (v) => `${v.toFixed(1)}%`)}
      </div>
    </Board>
  );
}
