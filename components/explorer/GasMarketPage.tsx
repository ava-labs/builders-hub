"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useExplorerTimeRange,
  RANGE_DAYS,
  type ExplorerRange,
} from "@/components/explorer-v2/time-range";
import { useContractNames } from "@/lib/sourcify-client";
import type {
  GasDayPoint,
  GasHistoryDays,
  GasHourPoint,
  GasMarket,
  GasProtocol,
  GasRangeDays,
} from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";
import { LiveReadout } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { ShareMap, TAIL_TONE } from "@/components/explorer-v2/ShareMap";
import { dayLong, dayShort, hourLong, truncate } from "@/components/explorer-v2/format";
import { ColumnsBlock, TraceBlock, WeekGrid, cellName, type TraceRow } from "@/components/explorer-v2/gas/instruments";

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

/** a selector's bare name: local pins first, then the decoded signature */
export function selectorName(selector: string, decoded?: string | null): string {
  const sig = SELECTOR_NAMES[selector] ?? decoded;
  return sig?.split("(")[0] ?? selector;
}

/* what a transaction costs right now — typical gas of common actions */
const ACTIONS: { label: string; gas: number }[] = [
  { label: "Native Transfer", gas: 21_000 },
  { label: "ERC-20 Transfer", gas: 55_000 },
  { label: "DEX Swap", gas: 165_000 },
  { label: "NFT Mint", gas: 120_000 },
];





/* ---------------------------------------------------------------- */
/* hour-of-week seasonality heatmap — when is blockspace cheap?      */
/* ---------------------------------------------------------------- */



/* ---------------------------------------------------------------- */
/* demand decomposition + fullness distribution                      */
/* ---------------------------------------------------------------- */



/* ---------------------------------------------------------------- */
/* the blockspace-buyers treemap — squarify over protocol groups     */
/* ---------------------------------------------------------------- */


/* display name: registry protocol, else sourcify name, else short addr */
function protocolLabel(p: GasProtocol, names: Map<string, string>): string {
  if (!p.address) return p.name;
  return names.get(p.address.toLowerCase()) ?? shortAddr(p.address);
}

/* a protocol opens on its busiest contract in the window */
function protocolHref(p: GasProtocol, base: string): string | null {
  const a = p.address ?? p.topContract;
  return a ? `${base}/address/${a}` : null;
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
  // complete UTC days only: today's partial day would read as a collapse
  const windowedDaily = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (history ?? []).filter((d) => d.d < today).slice(-RANGE_DAYS[range]);
  }, [history, range]);
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


  // gas-unit price a normal sender pays right now: base fee + median tip
  const effectiveWei =
    fee.baseFeeWei !== null ? fee.baseFeeWei + (fee.tipMidWei ?? 0) : null;

  const protocolsTotalGas = market?.protocols.reduce((s, p) => s + p.gas, 0) ?? 0;
  const protocolsCoveragePct =
    market && market.rangeTotalGas > 0
      ? Math.min(100, (protocolsTotalGas / market.rangeTotalGas) * 100)
      : null;

  // the cost of an everyday action, in money when the token is priced
  const costOf = (gas: number): string => {
    if (effectiveWei === null) return "—";
    const wei = effectiveWei * gas;
    if (usd !== null) return fmtUsd((wei / 1e18) * usd);
    return usdSettled ? `${fmtNative(wei)} ${symbol}` : "…";
  };
  const reverted = market?.reverted;
  const revertedGasPct = reverted && reverted.gas > 0 ? (reverted.revertedGas / reverted.gas) * 100 : null;

  // the window's base-fee series and its typical value, the median of medians
  const feeSeries = isHourly ? market?.hourly ?? [] : windowedDaily;
  const feeRows = useMemo(() => feeTraceRows(feeSeries), [feeSeries]);
  const feeTypical = feeSeries.length ? [...feeSeries.map((d) => d.p50)].sort((a, b) => a - b)[Math.floor(feeSeries.length / 2)] : null;

  const protocolParts = protocolShareParts(market?.protocols ?? [], names, base);

  return (
    <div className="flex flex-col gap-12">
      {/* the answer first, as readout blocks: what things cost this
          second, and the market those prices come off */}
      <section className="flex flex-col gap-4">
        <LiveReadout
          chainId={String(evmChainId)}
          cells={[
            {
              label: "Base Fee",
              live: true,
              href: `${base}/gas/base-fee`,
              value: fee.baseFeeWei !== null ? fmtNano(fee.baseFeeWei) : "—",
              unit: fee.baseFeeWei !== null ? unit : undefined,
              sub: "per gas",
              values: market?.hourly.map((h) => h.p50),
            },
            {
              label: `Send ${symbol || "tokens"}`,
              live: true,
              value: costOf(ACTIONS[0].gas),
              sub: effectiveWei !== null ? `${fmtNano(effectiveWei * ACTIONS[0].gas)} ${unit}` : undefined,
            },
            {
              label: "DEX Swap",
              live: true,
              value: costOf(ACTIONS[2].gas),
              sub: `~${(ACTIONS[2].gas / 1000).toFixed(0)}K gas`,
            },
            {
              label: "Utilization",
              live: true,
              href: `${base}/gas/utilization`,
              value: avgUtil !== null ? avgUtil.toFixed(1) : "—",
              unit: avgUtil !== null ? "%" : undefined,
              sub: `last ${FEE_HISTORY_BLOCKS} blocks`,
              values: fee.utilization.length ? fee.utilization.map((u) => u * 100) : undefined,
            },
            {
              // block headers: since Helicon they carry the gas RESERVED
              // (the sum of every tx's gas limit), not the gas used
              label: "Gas Reserved · 24h",
              href: `${base}/gas/utilization`,
              value: gas24h !== null ? fmtGas(gas24h) : "—",
              sub: revertedGasPct !== null && range === "day" ? `${revertedGasPct.toFixed(0)}% by reverts` : "hourly",
              values: market?.hourly.slice(-24).map((h) => h.gas),
            },
          ]}
        />
        <p className="font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          Priced at the live base fee plus the median priority tip, with typical gas per action
          {usd !== null ? `, ${symbol} at $${usd >= 1 ? usd.toFixed(2) : usd.toPrecision(3)}` : ""}. An ERC-20 transfer costs {costOf(ACTIONS[1].gas)} and an NFT mint {costOf(ACTIONS[3].gas)}. Real costs vary by contract.
        </p>
      </section>

      {/* the fee over the clock beside the last blocks' fullness */}
      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        {feeRows.length ? (
          <TraceBlock
            label="Base Fee"
            note={isHourly ? "last 48 hours" : null}
            href={`${base}/gas/base-fee`}
            figure={feeTypical !== null ? fmtFee(feeTypical) : "—"}
            unit={unit}
            sub={`typical ${isHourly ? "hour" : "day"} · the band holds the middle half of blocks`}
            legend={<BandKey unit={unit} />}
            rows={feeRows}
            band
            fmt={fmtFee}
            tip={(r) => <FeeTip r={r} unit={unit} />}
          />
        ) : (
          <HistoryEmpty missing={isHourly ? marketMissing : historyMissing} />
        )}

        {fee.utilization.length ? (
          <ColumnsBlock
            label="Block Fullness"
            note={`last ${FEE_HISTORY_BLOCKS} blocks, live`}
            href={`${base}/gas/utilization`}
            figure={avgUtil !== null ? avgUtil.toFixed(1) : "—"}
            unit="%"
            sub={`average · the fullest reached ${Math.max(...utilData.map((u) => u.pct)).toFixed(0)}%`}
            cols={utilData.map((u) => ({ key: String(u.i), long: u.i === utilData.length - 1 ? "the latest block" : `${utilData.length - 1 - u.i} blocks ago`, tick: u.i === 0 ? `${utilData.length} blocks ago` : u.i === utilData.length - 1 ? "latest" : "", v: u.pct }))}
            ticks={[0, utilData.length - 1]}
            max={100}
            vessel
            live
            avg={avgUtil !== null ? { v: avgUtil, label: `avg ${avgUtil.toFixed(0)}%` } : undefined}
            fmt={(v) => `${v.toFixed(0)}%`}
            tip={(c) => (
              <>
                <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{c.v.toFixed(1)}% full</p>
                <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
              </>
            )}
          />
        ) : (
          <p className="flex h-40 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            Waiting for RPC…
          </p>
        )}
      </div>

      {/* what the gas bought: by call, then by contract, as share maps */}
      {protocolParts.length > 0 && (
        <div className={cn(rangeStale && "opacity-60 transition-opacity")}>
          <ShareMap
            label="Where the gas goes"
            summary={protocolsCoveragePct !== null && market ? `the top contracts: ${protocolsCoveragePct.toFixed(0)}% of ${fmtGas(market.rangeTotalGas)} gas` : undefined}
            parts={protocolParts}
            fmt={(v) => `${fmtGas(v)} gas`}
            note={
              <>
                {revertedGasPct !== null && reverted
                  ? `${revertedGasPct.toFixed(0)}% of this gas was spent by transactions that reverted (${reverted.revertedTxs.toLocaleString("en-US")} of ${reverted.txs.toLocaleString("en-US")}). `
                  : ""}
                Contracts grouped by protocol where the registry knows them. <Link href={`${base}/gas/demand`} className="underline decoration-dotted underline-offset-4 hover:text-[#E6212F]">The full table</Link> has fees, senders and the move against the previous window.
              </>
            }
          />
        </div>
      )}

      {/* the longer record, and when blockspace is cheap */}
      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {gasBars.length ? (
            <GasReservedBlock rows={gasBars} note={isHourly ? "7 days" : null} href={`${base}/gas/utilization`} stale={false} />
          ) : (
            <HistoryEmpty missing={historyMissing} />
          )}
          <HeliconNote />
        </div>

        {market && market.heatmap.length > 0 && (
          <WeekBlock cells={market.heatmap} unit={unit} href={`${base}/gas/fee-seasonality`} stale={rangeStale} />
        )}
      </div>
    </div>
  );
}

/** a fee in the chain's nano unit, as many digits as it needs */
export function fmtFee(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US");
  if (v >= 1) return v.toFixed(2);
  if (v <= 0) return "0";
  return v.toPrecision(3);
}

/** the base fee's rows for the trace, from daily or hourly percentiles */
export function feeTraceRows(rows: (GasDayPoint | GasHourPoint)[]): TraceRow[] {
  return rows.map((d) => {
    const hourly = "t" in d;
    const at = hourly ? d.t : d.d;
    return {
      key: at,
      long: hourly ? hourLong(at) : dayLong(at),
      tick: hourly ? `${dayShort(at)} ${at.slice(11, 13)}:00` : dayShort(at),
      mid: d.p50,
      lo: d.p25,
      hi: d.p75,
      p95: d.p95,
    } as TraceRow & { p95: number };
  });
}

export function FeeTip({ r, unit }: { r: TraceRow; unit: string }) {
  const p95 = (r as TraceRow & { p95?: number }).p95;
  return (
    <>
      <p className="font-mono text-[10px] text-zinc-500">{r.long}</p>
      <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {fmtFee(r.mid)} {unit} median
      </p>
      <p className="font-mono text-[10px] tabular-nums text-zinc-500">
        middle half {fmtFee(r.lo ?? r.mid)} to {fmtFee(r.hi ?? r.mid)}
        {p95 !== undefined ? ` · p95 ${fmtFee(p95)}` : ""}
      </p>
    </>
  );
}

/* the Helicon date inside a daily series, if the window holds it */
const HELICON_DAY = "2026-09-22";

export function HeliconNote() {
  return (
    <p className="px-1 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
      Since Helicon (Sep 22, 2026) a block reserves each transaction&apos;s gas limit when it is accepted, and a transaction is charged the larger of its gas used and half its limit. Before, all three were the gas used.
    </p>
  );
}

/** the gas blocks reserved each day, as cuboids, with Helicon marked */
export function GasReservedBlock({ rows, note, href, stale, height }: { rows: GasDayPoint[]; note?: string | null; href?: string; stale?: boolean; height?: number }) {
  const total = rows.reduce((s, d) => s + d.gas, 0);
  return (
    <ColumnsBlock
      label="Gas Reserved"
      note={note}
      href={href}
      stale={stale}
      height={height}
      figure={fmtGas(total)}
      sub={`${fmtGas(rows.length ? total / rows.length : 0)} per day · ${rows.length} days`}
      cols={rows.map((d) => ({ key: d.d, long: dayLong(d.d), tick: dayShort(d.d), v: d.gas }))}
      marker={rows.some((d) => d.d === HELICON_DAY) ? { key: HELICON_DAY, label: "Helicon" } : undefined}
      fmt={fmtGas}
      tip={(c) => {
        const d = rows.find((r) => r.d === c.key)!;
        return (
          <>
            <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
            <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{fmtGas(d.gas)} gas reserved</p>
            <p className="font-mono text-[10px] tabular-nums text-zinc-500">
              blocks {d.utilPct.toFixed(1)}% full on average · {d.blocks.toLocaleString("en-US")} blocks
            </p>
          </>
        );
      }}
    />
  );
}

/** the week's hours, flat, with the cheapest one as the headline */
export function WeekBlock({ cells, unit, href, stale, note }: { cells: GasMarket["heatmap"]; unit: string; href?: string; stale?: boolean; note?: string | null }) {
  const live = cells.filter((c) => c.p50 > 0);
  const cheapest = live.reduce<(typeof live)[number] | null>((m, c) => (!m || c.p50 < m.p50 ? c : m), null);
  const priciest = live.reduce<(typeof live)[number] | null>((m, c) => (!m || c.p50 > m.p50 ? c : m), null);
  return (
    <WeekGrid
      label="When Gas Is Cheap"
      note={note}
      href={href}
      stale={stale}
      figure={cheapest ? cellName(cheapest).replace(" UTC", "") : "—"}
      unit={cheapest ? "UTC" : undefined}
      sub={cheapest && priciest ? `median ${fmtFee(cheapest.p50)} ${unit} · priciest ${cellName(priciest)}` : undefined}
      cells={cells}
      feeUnit={unit}
      fmt={fmtFee}
    />
  );
}


/** the buyers as share-map parts; the long-tail group is a remainder, so it closes the strip */
export function protocolShareParts(protocols: GasProtocol[], names: Map<string, string>, base: string) {
  return [...protocols].sort((a, b) => Number(/long tail/i.test(a.name) && !a.address) - Number(/long tail/i.test(b.name) && !b.address)).map((p) => {
    const tail = !p.address && /long tail/i.test(p.name);
    const named = p.address ? names.get(p.address.toLowerCase()) : p.name;
    return {
      key: p.key,
      label: named ?? (p.address ? truncate(p.address, 10) : p.name),
      value: p.gas,
      mono: !named,
      href: protocolHref(p, base) ?? undefined,
      sub: [p.category, `${p.txs.toLocaleString("en-US")} txs`, `${p.senders.toLocaleString("en-US")} sender${p.senders === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
      detail: p.address ?? undefined,
      tone: tail ? TAIL_TONE : undefined,
    };
  });
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
