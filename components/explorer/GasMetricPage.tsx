"use client";

import { useEffect, useMemo, useState } from "react";
import { SheetFrame, SiblingDoor, dayLabel } from "@/components/explorer-v2/metric-sheet";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { ShareMap } from "@/components/explorer-v2/ShareMap";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { dayLong, dayShort, hourLong } from "@/components/explorer-v2/format";
import { ColumnsBlock, Instrument, RankBars, TraceBlock, WeekTerrain, DOW, cellName, type Col, type HeatCell } from "@/components/explorer-v2/gas/instruments";
import {
  BandKey,
  FEE_HISTORY_BLOCKS,
  FeeTip,
  GasReservedBlock,
  HeliconNote,
  HistoryEmpty,
  ProtocolTable,
  WeekBlock,
  feeTraceRows,
  fmtFee,
  fmtGas,
  fmtNano,
  nanoUnit,
  protocolShareParts,
  selectorName,
  useFeeHistory,
  useGasHistory,
} from "@/components/explorer/GasMarketPage";
import { useContractNames } from "@/lib/sourcify-client";
import { GAS_METRICS, type GasMetricKey } from "@/components/explorer/gas-metrics";
import type { GasDayPoint, GasHistoryDays, GasHourPoint, GasMarket } from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";

/* The per-metric detail sheets behind the Gas tab's figures: one figure,
   everything we know about it. The frame (breadcrumb, title, blurb,
   methodology colophon) is shared; each sheet leads with its readouts and
   composes the gas instruments below them, in the Gas tab's own grammar. */

/* ---------------------------------------------------------------- */
/* data                                                              */
/* ---------------------------------------------------------------- */

function useGasMarket(evmChainId: number, rangeDays: number) {
  const [market, setMarket] = useState<GasMarket | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setMissing(false);
    fetch(`/api/gas-market/${evmChainId}?range=${rangeDays}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: GasMarket) => {
        if (!cancelled) setMarket(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, rangeDays]);
  // a window switch keeps the last payload on screen, dimmed, until the new one lands
  return { market, missing, stale: market !== null && market.rangeDays !== rangeDays };
}

/* the clock's window, in the vocabularies this sheet's two feeds accept */
function historyDays(range: ExplorerRange): GasHistoryDays {
  const d = RANGE_DAYS[range];
  return d <= 7 ? 7 : d <= 30 ? 30 : d <= 90 ? 90 : 365;
}

/* complete UTC days only: today's partial day would read as a collapse */
function completeDays(daily: GasDayPoint[] | null, days: number): GasDayPoint[] {
  const today = new Date().toISOString().slice(0, 10);
  return (daily ?? []).filter((d) => d.d < today).slice(-days);
}

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/* ---------------------------------------------------------------- */
/* shared frame                                                      */
/* ---------------------------------------------------------------- */

function MetricFrame({ base, chainName, metric, children }: { base: string; chainName: string; metric: GasMetricKey; children: React.ReactNode }) {
  const def = GAS_METRICS[metric];
  return (
    <SheetFrame backHref={`${base}/gas`} backLabel={`Gas · ${chainName}`} title={def.title} blurb={def.blurb} methodology={def.methodology}>
      {children}
    </SheetFrame>
  );
}

const GRID = "grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2";

/** how far p95 rides above the median, per bucket: the volatility one fee line hides */
function spikeCols(rows: (GasDayPoint | GasHourPoint)[]): Col[] {
  return rows.map((d) => {
    const hourly = "t" in d;
    const at = hourly ? d.t : d.d;
    return {
      key: at,
      long: hourly ? hourLong(at) : dayLong(at),
      tick: hourly ? `${dayShort(at)} ${at.slice(11, 13)}:00` : dayShort(at),
      v: d.p50 > 0 ? ((d.p95 - d.p50) / d.p50) * 100 : 0,
      p50: d.p50,
      p95: d.p95,
    } as Col & { p50: number; p95: number };
  });
}

/* ---------------------------------------------------------------- */
/* Base Fee                                                          */
/* ---------------------------------------------------------------- */

function BaseFeeSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);
  const { daily, missing } = useGasHistory(evmChainId, historyDays(range));
  const { market, missing: marketMissing, stale } = useGasMarket(evmChainId, Math.min(RANGE_DAYS[range], 90));

  const isHourly = range === "day";
  const windowed = useMemo(() => completeDays(daily, RANGE_DAYS[range]), [daily, range]);
  const main: (GasDayPoint | GasHourPoint)[] = isHourly ? (market?.hourly ?? []) : windowed;
  // the other time scale beside the one the clock picked
  const other: (GasDayPoint | GasHourPoint)[] = isHourly ? completeDays(daily, 7) : (market?.hourly ?? []);
  const windowLabel = isHourly ? "last 48 hours" : range === "all" ? `${RANGE_LABEL.year}, longest window` : RANGE_LABEL[range];

  const stats = useMemo(() => {
    if (!main.length) return null;
    let high = main[0];
    let low = main[0];
    for (const p of main) {
      if (p.p95 > high.p95) high = p;
      if (p.p50 < low.p50) low = p;
    }
    const when = (p: GasDayPoint | GasHourPoint) => ("t" in p ? hourLong(p.t) : dayLabel(p.d));
    return { typical: median(main.map((p) => p.p50)), high, low, when };
  }, [main]);

  const spark = main.map((p) => p.p50);
  const premium = spikeCols(main);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="base-fee">
      <ReadoutRow cols={4}>
        <Readout label="Right Now" live value={fee.baseFeeWei !== null ? fmtNano(fee.baseFeeWei) : null} unit={unit} sub="the next block's base fee" />
        <Readout label="Typical" value={stats ? fmtFee(stats.typical) : null} unit={unit} sub={`median of ${isHourly ? "hourly" : "daily"} medians`} spark={spark} />
        <Readout label="Spike" value={stats ? fmtFee(stats.high.p95) : null} unit={unit} sub={stats ? `highest p95 · ${stats.when(stats.high)}` : undefined} />
        <Readout label="Floor" value={stats ? fmtFee(stats.low.p50) : null} unit={unit} sub={stats ? `lowest median · ${stats.when(stats.low)}` : undefined} />
      </ReadoutRow>

      {main.length ? (
        <TraceBlock
          label="Base Fee"
          note={windowLabel}
          stale={isHourly && stale}
          figure={stats ? fmtFee(stats.typical) : "—"}
          unit={unit}
          sub="typical · the band holds the middle half of blocks"
          legend={<BandKey unit={unit} />}
          rows={feeTraceRows(main)}
          band
          height={280}
          fmt={fmtFee}
          tip={(r) => <FeeTip r={r} unit={unit} />}
        />
      ) : (
        <HistoryEmpty missing={isHourly ? marketMissing : missing} />
      )}

      <div className={GRID}>
        {other.length ? (
          <TraceBlock
            label="Base Fee"
            note={isHourly ? "last 7 days, daily" : "last 48 hours, hourly"}
            legend={<BandKey unit={unit} />}
            rows={feeTraceRows(other)}
            band
            fmt={fmtFee}
            tip={(r) => <FeeTip r={r} unit={unit} />}
          />
        ) : (
          <HistoryEmpty missing={isHourly ? missing : marketMissing} />
        )}
        {premium.length ? (
          <ColumnsBlock
            label="Spike Premium"
            note={windowLabel}
            figure={`+${median(premium.map((c) => c.v)).toFixed(0)}`}
            unit="%"
            sub="typical p95 over the median"
            cols={premium}
            fmt={(v) => `+${v.toFixed(0)}%`}
            tip={(c) => {
              const d = c as Col & { p50: number; p95: number };
              return (
                <>
                  <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
                  <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">+{c.v.toFixed(0)}% spike premium</p>
                  <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                    p95 {fmtFee(d.p95)} vs median {fmtFee(d.p50)} {unit}
                  </p>
                </>
              );
            }}
          />
        ) : (
          <HistoryEmpty missing={isHourly ? marketMissing : missing} />
        )}
      </div>

      {market && market.heatmap.length > 0 && <WeekBlock cells={market.heatmap} unit={unit} href={`${base}/gas/fee-seasonality`} stale={stale} />}

      <SiblingDoor href={`${base}/gas/utilization`} label="Utilization" sub="the demand these prices respond to, block by block" />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Utilization                                                       */
/* ---------------------------------------------------------------- */

/** the live window's blocks as vessels, the latest in red */
function LiveBlocks({ utilization, height }: { utilization: number[]; height?: number }) {
  const pct = utilization.map((u) => u * 100);
  const avg = pct.length ? pct.reduce((s, v) => s + v, 0) / pct.length : 0;
  const n = pct.length;
  return (
    <ColumnsBlock
      label="Block by Block"
      note={`last ${FEE_HISTORY_BLOCKS} blocks, live`}
      figure={avg.toFixed(1)}
      unit="%"
      sub={`average · the fullest reached ${Math.max(...pct).toFixed(0)}%`}
      cols={pct.map((v, i) => ({
        key: String(i),
        long: i === n - 1 ? "the latest block" : `${n - 1 - i} blocks ago`,
        tick: i === 0 ? `${n} blocks ago` : i === n - 1 ? "latest" : "",
        v,
      }))}
      ticks={[0, n - 1]}
      max={100}
      vessel
      live
      height={height}
      avg={{ v: avg, label: `avg ${avg.toFixed(0)}%` }}
      fmt={(v) => `${v.toFixed(0)}%`}
      tip={(c) => (
        <>
          <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{c.v.toFixed(1)}% full</p>
          <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
        </>
      )}
    />
  );
}

function UtilizationSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);
  const { daily, missing } = useGasHistory(evmChainId, historyDays(range));
  // the fullness histogram rides the market's demand window, which caps at 90d
  const { market, missing: marketMissing, stale } = useGasMarket(evmChainId, Math.min(RANGE_DAYS[range], 90));

  // a one-point daily chart says nothing: the day view reads a week, labeled
  const trend = useMemo(() => completeDays(daily, Math.max(7, RANGE_DAYS[range])), [daily, range]);
  const trendNote = range === "day" ? RANGE_LABEL.week : RANGE_LABEL[range];
  const histNote = RANGE_DAYS[range] > 90 ? `${RANGE_LABEL.quarter}, longest computed` : RANGE_LABEL[range];

  const liveUtil = fee.utilization.length ? (fee.utilization.reduce((s, u) => s + u, 0) / fee.utilization.length) * 100 : null;
  const stats = useMemo(() => {
    if (!trend.length) return null;
    const avg = trend.reduce((s, p) => s + p.utilPct, 0) / trend.length;
    let busiest = trend[0];
    for (const p of trend) if (p.utilPct > busiest.utilPct) busiest = p;
    return { avg, busiest, totalGas: trend.reduce((s, p) => s + p.gas, 0) };
  }, [trend]);

  const hist = market?.histogram ?? [];
  const histTotal = hist.reduce((s, b) => s + b.blocks, 0);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="utilization">
      <ReadoutRow cols={4}>
        <Readout
          label="Right Now"
          live
          value={liveUtil !== null ? liveUtil.toFixed(1) : null}
          unit="%"
          sub={`last ${FEE_HISTORY_BLOCKS} blocks`}
          spark={fee.utilization.length ? fee.utilization.map((u) => u * 100) : undefined}
        />
        <Readout label="Average" value={stats ? stats.avg.toFixed(1) : null} unit="%" sub={trendNote} spark={trend.map((p) => p.utilPct)} />
        <Readout label="Busiest Day" value={stats ? stats.busiest.utilPct.toFixed(1) : null} unit="%" sub={stats ? dayLabel(stats.busiest.d) : undefined} />
        <Readout label="Gas Reserved" value={stats ? fmtGas(stats.totalGas) : null} sub="the sum of tx gas limits since Helicon" spark={trend.map((p) => p.gas)} />
      </ReadoutRow>

      <div className={GRID}>
        {fee.utilization.length ? <LiveBlocks utilization={fee.utilization} height={200} /> : <HistoryEmpty missing={false} />}
        {trend.length ? (
          <TraceBlock
            label="Daily Utilization"
            note={trendNote}
            figure={stats ? stats.avg.toFixed(1) : "—"}
            unit="%"
            sub="average block, gas against the limit"
            rows={trend.map((d) => ({ key: d.d, long: dayLong(d.d), tick: dayShort(d.d), mid: d.utilPct }))}
            height={200}
            fmt={(v) => `${v.toFixed(1)}%`}
            tip={(r) => {
              const d = trend.find((p) => p.d === r.key)!;
              return (
                <>
                  <p className="font-mono text-[10px] text-zinc-500">{r.long}</p>
                  <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{d.utilPct.toFixed(1)}% utilized</p>
                  <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                    {fmtGas(d.gas)} gas reserved · {d.blocks.toLocaleString("en-US")} blocks
                  </p>
                </>
              );
            }}
          />
        ) : (
          <HistoryEmpty missing={missing} />
        )}
      </div>

      <div className={GRID}>
        {hist.length ? (
          <ColumnsBlock
            label="Fullness Distribution"
            note={histNote}
            stale={stale}
            figure={histTotal.toLocaleString("en-US")}
            unit="blocks"
            sub="counted by how full they ran"
            cols={hist.map((b) => ({ key: b.bucket, long: `${b.bucket} full`, tick: b.bucket, v: b.blocks }))}
            ticks={hist.map((_, i) => i)}
            fmt={(v) => v.toLocaleString("en-US")}
            tip={(c) => (
              <>
                <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{c.long}</p>
                <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                  {c.v.toLocaleString("en-US")} blocks · {histTotal ? ((c.v / histTotal) * 100).toFixed(1) : 0}%
                </p>
              </>
            )}
          />
        ) : (
          <HistoryEmpty missing={marketMissing} />
        )}
        <div className="flex flex-col gap-3">
          {trend.length ? <GasReservedBlock rows={trend} note={`${trendNote}, daily`} /> : <HistoryEmpty missing={missing} />}
          <HeliconNote />
        </div>
      </div>

      <SiblingDoor href={`${base}/gas/base-fee`} label="Base Fee" sub="the price this demand sets, percentile by percentile" />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Fee Seasonality                                                   */
/* ---------------------------------------------------------------- */

/** the week collapsed one way: a median per hour of day, or per weekday */
function profile(cells: HeatCell[], by: "hour" | "dow"): Col[] {
  const keys = by === "hour" ? Array.from({ length: 24 }, (_, h) => h) : DOW.map((_, i) => i + 1);
  return keys.map((k) => {
    const v = median(cells.filter((c) => (by === "hour" ? c.hour === k : c.dow === k) && c.p50 > 0).map((c) => c.p50));
    const name = by === "hour" ? `${String(k).padStart(2, "0")}:00` : DOW[k - 1];
    return { key: String(k), long: by === "hour" ? `${name} UTC · all days` : `${name} · all hours`, tick: name, v };
  });
}

/** the hours someone schedules against, cheapest or priciest first */
function HourList({ label, cells, unit, weekMedian }: { label: string; cells: HeatCell[]; unit: string; weekMedian: number }) {
  return (
    <Instrument label={label} note="vs the week's median hour" bodyClass="pb-2">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {cells.map((c) => {
          const vs = weekMedian > 0 ? ((c.p50 - weekMedian) / weekMedian) * 100 : 0;
          return (
            <div key={`${c.dow}-${c.hour}`} className="flex items-center justify-between gap-4 px-5 py-2.5 md:px-6">
              <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">{cellName(c)}</span>
              <span className="flex items-center gap-3 font-mono text-[12px] tabular-nums">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {fmtFee(c.p50)} {unit}
                </span>
                <span className={vs > 0 ? "w-12 text-right text-[#E6212F]" : "w-12 text-right text-zinc-400 dark:text-zinc-500"}>
                  {vs > 0 ? "+" : ""}
                  {vs.toFixed(0)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Instrument>
  );
}

function SeasonalitySheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  // the heatmap needs a full week for its 168 cells and the market fetch
  // caps at a quarter: the window clamps both ways and the label says so
  const range = useExplorerTimeRange();
  const { market, missing, stale } = useGasMarket(evmChainId, Math.min(RANGE_DAYS[range], 90));
  const note = RANGE_DAYS[range] < 7 ? `${RANGE_LABEL.week}, shortest weekly window` : RANGE_DAYS[range] > 90 ? `${RANGE_LABEL.quarter}, longest computed` : RANGE_LABEL[range];

  const cells = useMemo(() => (market?.heatmap ?? []).filter((c) => c.p50 > 0), [market]);
  const stats = useMemo(() => {
    if (!cells.length) return null;
    const sorted = [...cells].sort((a, b) => a.p50 - b.p50);
    const weekday = median(cells.filter((c) => c.dow <= 5).map((c) => c.p50));
    const weekend = median(cells.filter((c) => c.dow >= 6).map((c) => c.p50));
    return {
      cheapest: sorted[0],
      priciest: sorted[sorted.length - 1],
      weekMedian: median(cells.map((c) => c.p50)),
      weekendVsWeekday: weekday > 0 ? ((weekend - weekday) / weekday) * 100 : 0,
      low5: sorted.slice(0, 5),
      high5: sorted.slice(-5).reverse(),
    };
  }, [cells]);

  const hours = profile(cells, "hour");
  const days = profile(cells, "dow");
  const profileTip = (c: Col) => (
    <>
      <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
      <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {fmtFee(c.v)} {unit} median
      </p>
    </>
  );

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="fee-seasonality">
      <ReadoutRow cols={3}>
        <Readout label="Cheapest Hour" value={stats ? fmtFee(stats.cheapest.p50) : null} unit={unit} sub={stats ? cellName(stats.cheapest) : undefined} />
        <Readout label="Priciest Hour" value={stats ? fmtFee(stats.priciest.p50) : null} unit={unit} sub={stats ? cellName(stats.priciest) : undefined} />
        <Readout label="Weekend vs Weekday" value={stats ? `${stats.weekendVsWeekday > 0 ? "+" : ""}${stats.weekendVsWeekday.toFixed(0)}` : null} unit="%" sub="median base fee" />
      </ReadoutRow>

      {/* a phone is too narrow for the terrain: it reads the flat week */}
      {market?.heatmap.length ? (
        <div className="sm:hidden">
          <WeekBlock cells={market.heatmap} unit={unit} note={note} stale={stale} />
        </div>
      ) : null}
      {market?.heatmap.length ? (
        <div className="hidden sm:block">
          <WeekTerrain
            label="The Week"
            note={note}
            stale={stale}
            figure={stats ? cellName(stats.cheapest).replace(" UTC", "") : "—"}
            unit={stats ? "UTC" : undefined}
            sub={stats ? `the cheapest hour · each column is an hour, as tall as its median fee and as red as its rank` : undefined}
            cells={market.heatmap}
            feeUnit={unit}
            fmt={fmtFee}
          />
        </div>
      ) : (
        <HistoryEmpty missing={missing} />
      )}

      {cells.length > 0 && (
        <div className={GRID}>
          <ColumnsBlock label="Hour of Day" note="all days collapsed" cols={hours} ticks={[0, 6, 12, 18, 23]} fmt={fmtFee} tip={profileTip} />
          <ColumnsBlock label="Day of Week" note="all hours collapsed" cols={days} ticks={days.map((_, i) => i)} fmt={fmtFee} tip={profileTip} />
        </div>
      )}

      {stats && (
        <div className={GRID}>
          <HourList label="Cheapest Hours" cells={stats.low5} unit={unit} weekMedian={stats.weekMedian} />
          <HourList label="Priciest Hours" cells={stats.high5} unit={unit} weekMedian={stats.weekMedian} />
        </div>
      )}

      <SiblingDoor href={`${base}/gas/base-fee`} label="Base Fee" sub="the price this rhythm plays out in, hour by hour" />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Blockspace Demand                                                 */
/* ---------------------------------------------------------------- */

function DemandSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const symbol = catalog.networkToken?.symbol ?? "AVAX";
  const range = useExplorerTimeRange();
  // the demand aggregations scan raw_txs, which caps the window at 90d
  const rangeDays = Math.min(RANGE_DAYS[range], 90);
  const windowLabel = RANGE_DAYS[range] > 90 ? `${RANGE_LABEL.quarter}, longest computed` : RANGE_LABEL[range];
  const { market, missing, stale } = useGasMarket(evmChainId, rangeDays);

  const unknown = useMemo(() => market?.protocols.flatMap((p) => (p.address ? [p.address] : [])) ?? [], [market]);
  const names = useContractNames(evmChainId, unknown);
  const parts = protocolShareParts(market?.protocols ?? [], names, base);

  const top = market?.protocols[0];
  const reverted = market?.reverted;
  const revertedPct = reverted && reverted.gas > 0 ? (reverted.revertedGas / reverted.gas) * 100 : null;
  const selTotal = market?.selectors.reduce((s, x) => s + x.gas, 0) ?? 0;

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="demand">
      <ReadoutRow cols={4}>
        <Readout label="Total Gas" value={market ? fmtGas(market.rangeTotalGas) : null} sub={windowLabel} />
        <Readout label="Transactions" value={reverted ? reverted.txs.toLocaleString("en-US") : null} sub={windowLabel} />
        <Readout
          label="Top Buyer"
          value={top ? (top.address ? (names.get(top.address.toLowerCase()) ?? top.name) : top.name) : null}
          sub={top ? `${top.sharePct.toFixed(1)}% of the window's gas` : undefined}
        />
        <Readout
          label="Reverted"
          value={revertedPct !== null ? revertedPct.toFixed(1) : null}
          unit="%"
          sub={reverted ? `of gas · ${reverted.revertedTxs.toLocaleString("en-US")} txs paid for nothing` : undefined}
        />
      </ReadoutRow>

      {parts.length > 0 ? (
        <div className={stale ? "opacity-60 transition-opacity" : undefined}>
          <ShareMap label="Where the gas goes" summary={market ? `${fmtGas(market.rangeTotalGas)} gas · ${windowLabel}` : undefined} parts={parts} fmt={(v) => `${fmtGas(v)} gas`} />
        </div>
      ) : (
        <HistoryEmpty missing={missing} />
      )}

      {market?.protocols.length ? (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Every buyer" />
          <div className="overflow-x-auto">
            <ProtocolTable protocols={market.protocols} names={names} base={base} symbol={symbol} />
          </div>
        </section>
      ) : null}

      {market?.selectors.length ? (
        <RankBars
          label="By Method"
          note={windowLabel}
          stale={stale}
          figure={selectorName(market.selectors[0].selector, market.selectors[0].name)}
          sub={`the heaviest call · ${selTotal ? ((market.selectors[0].gas / selTotal) * 100).toFixed(1) : 0}% of this gas`}
          rows={market.selectors.map((x) => ({
            key: x.selector,
            name: selectorName(x.selector, x.name),
            title: `${x.name ?? x.selector} · ${x.selector}`,
            value: x.gas,
            share: `${selTotal ? ((x.gas / selTotal) * 100).toFixed(1) : 0}% · ${fmtGas(x.gas)}`,
          }))}
        />
      ) : null}

      <SiblingDoor href={`${base}/gas/utilization`} label="Utilization" sub="how full this demand actually runs the blocks" />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* entry                                                             */
/* ---------------------------------------------------------------- */

export function GasMetricContent({ catalog, base, metric }: { catalog: L1Chain; base: string; metric: GasMetricKey }) {
  if (metric === "base-fee") return <BaseFeeSheet catalog={catalog} base={base} />;
  if (metric === "utilization") return <UtilizationSheet catalog={catalog} base={base} />;
  if (metric === "demand") return <DemandSheet catalog={catalog} base={base} />;
  return <SeasonalitySheet catalog={catalog} base={base} />;
}
