"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { Board, SectionHeader, StatDash } from "@/components/explorer-v2/ui";
import {
  ChartEmpty,
  RANGE_LABEL,
  RangeToggle,
  Stat,
  TipPlate,
  type RangeDays,
} from "@/components/explorer-v2/staking/bits";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";

/* The chain's Stats surface, rebuilt in the drafting grammar — the old
   Card-and-sticky-nav observatory folded into Boards on one shared clock.
   Every chart pairs its headline series with the overlay that explains it
   (senders under addresses, TPS over transactions, max gas price against
   the average), instead of fourteen single-series cards. Serves both the
   per-chain page and the network-wide aggregate (chainId="all"). */

interface SeriesPoint {
  timestamp: number;
  value: number;
  date: string;
}

interface MetricPayload {
  data: SeriesPoint[];
  current_value: number | string;
}

interface IcmPoint {
  timestamp: number;
  date: string;
  incomingCount: number;
  outgoingCount: number;
}

type Metrics = Partial<Record<string, MetricPayload>> & {
  icmMessages?: { data: IcmPoint[] };
};

const METRICS = [
  "activeAddresses",
  "activeSenders",
  "txCount",
  "cumulativeAddresses",
  "cumulativeTxCount",
  "contracts",
  "deployers",
  "gasUsed",
  "avgTps",
  "maxTps",
  "feesPaid",
  "avgGasPrice",
  "maxGasPrice",
  "icmMessages",
].join(",");

const QUIET = "#A2AFB2";
const PUNCH = "#E6212F";

function fmtCompact(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (v >= 10 || Number.isInteger(v)) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v.toFixed(2);
}

function num(v: number | string | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/* one day on the chart: the headline series plus an optional overlay */
interface DualPoint {
  date: string;
  a: number;
  b?: number;
}

/* newest-first API series → oldest-first, joined on date */
function joinSeries(a: SeriesPoint[] | undefined, b?: SeriesPoint[]): DualPoint[] {
  if (!a?.length) return [];
  const bByDate = b ? new Map(b.map((p) => [p.date, p.value])) : null;
  return a
    .map((p) => ({ date: p.date, a: p.value, b: bByDate?.get(p.date) }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

/* the workhorse: bars or area for the headline, a line for the overlay */
function DualChart({
  data,
  kind,
  fmt,
  aLabel,
  bLabel,
  bFmt,
  bOwnAxis = false,
}: {
  data: DualPoint[];
  kind: "bars" | "area";
  fmt: (v: number) => string;
  aLabel: string;
  bLabel?: string;
  bFmt?: (v: number) => string;
  /** overlay rides its own (hidden) axis when scales are incompatible */
  bOwnAxis?: boolean;
}) {
  const hasB = !!bLabel && data.some((d) => d.b !== undefined);
  return (
    <div className="h-44 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="22%">
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="a" hide domain={[0, "dataMax"]} />
          {hasB && bOwnAxis && <YAxis yAxisId="b" hide domain={[0, "dataMax"]} />}
          <RechartsTooltip
            cursor={
              kind === "bars"
                ? { fill: "rgba(161,161,170,0.08)" }
                : { stroke: "rgba(161,161,170,0.35)" }
            }
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as DualPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.date}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmt(d.a)} {aLabel}
                  </p>
                  {hasB && d.b !== undefined && (
                    <p className="text-[10px] tabular-nums text-zinc-500">
                      {(bFmt ?? fmt)(d.b)} {bLabel}
                    </p>
                  )}
                </TipPlate>
              );
            }}
          />
          {kind === "bars" ? (
            <Bar
              yAxisId="a"
              dataKey="a"
              fill={QUIET}
              fillOpacity={0.8}
              minPointSize={1}
              isAnimationActive={false}
            />
          ) : (
            <Area
              yAxisId="a"
              type="monotone"
              dataKey="a"
              stroke="currentColor"
              strokeWidth={1.5}
              fill="currentColor"
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          )}
          {hasB && (
            <Line
              yAxisId={bOwnAxis ? "b" : "a"}
              type="monotone"
              dataKey="b"
              stroke={PUNCH}
              strokeWidth={1.5}
              strokeDasharray={bOwnAxis ? "4 3" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* legend chip for a chart's overlay line */
function OverlayKey({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className={dashed ? "h-0.5 w-4 border-b border-dashed border-[#E6212F]" : "h-0.5 w-4 bg-[#E6212F]"} />
      {label}
    </span>
  );
}

function ChartSection({
  label,
  action,
  children,
  note,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={label} action={action} />
      <Board divide={false} className="px-5 py-5 md:px-6">
        {children}
      </Board>
      {note && <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{note}</p>}
    </section>
  );
}

export function EvmStats({
  chainId,
  chainName,
  chainSlug,
  tokenSymbol = "AVAX",
  intro,
}: {
  chainId: string;
  chainName: string;
  /** omit for the network-wide aggregate */
  chainSlug?: string;
  tokenSymbol?: string;
  intro?: string;
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<RangeDays>(90);
  const rangeLabel = RANGE_LABEL[range];
  const isAggregate = chainId === "all";

  useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    setFailed(false);
    // one fetch per window: the API caches per timeRange server-side
    const timeRange = range === 90 ? "90d" : range === 365 ? "1y" : "all";
    fetch(`/api/chain-stats/${chainId}?metrics=${METRICS}&timeRange=${timeRange}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: Metrics) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, range]);

  const m = metrics ?? {};
  const series = (key: string, overlay?: string): DualPoint[] =>
    thin(windowSeries(joinSeries(m[key]?.data, overlay ? m[overlay]?.data : undefined), range), 200);

  const icmSeries = useMemo(() => {
    const pts = metrics?.icmMessages?.data ?? [];
    return thin(
      windowSeries(
        [...pts].sort((a, b) => a.timestamp - b.timestamp),
        range,
      ),
      200,
    );
  }, [metrics, range]);

  const current = (key: string) => num(m[key]?.current_value);

  const strip: {
    label: string;
    value: number | null;
    fmt?: (v: number) => string;
    sub?: string;
  }[] = [
    {
      label: "Active Addresses · 24h",
      value: current("activeAddresses"),
      sub: current("activeSenders") !== null ? `${fmtCompact(current("activeSenders")!)} senders` : undefined,
    },
    {
      label: "Transactions · 24h",
      value: current("txCount"),
      sub: current("avgTps") !== null ? `avg ${current("avgTps")!.toFixed(1)} TPS` : undefined,
    },
    {
      label: "Fees Paid · 24h",
      value: current("feesPaid"),
      fmt: (v) => `${fmtCompact(v)} ${tokenSymbol}`,
      sub:
        current("avgGasPrice") !== null
          ? `avg gas ${current("avgGasPrice")!.toFixed(2)} n${tokenSymbol}`
          : undefined,
    },
    {
      label: "Contracts Deployed · 24h",
      value: current("contracts"),
      sub: current("deployers") !== null ? `${fmtCompact(current("deployers")!)} deployers` : undefined,
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-16 pt-10 md:px-6">
      <ExplorerSubnav
        network="mainnet"
        chainSlug={chainSlug}
        chainName={chainName}
        className="mb-8"
      />

      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            {isAggregate ? "Avalanche Ecosystem" : chainName}
          </p>
          <h1 className="v2-display text-4xl tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
            Stats
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {intro ??
              (isAggregate
                ? "Aggregated activity across every indexed Avalanche chain: addresses, transactions, contracts, gas, and fees."
                : `${chainName} by the numbers: who's using it, what it costs, and how hard it's working.`)}
          </p>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </header>

      {failed ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F]">
            Failed to load chain metrics
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* the chain right now — latest full day */}
          <Board divide={false}>
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
              {strip.map((s) => (
                <Stat key={s.label} label={s.label} sub={s.sub}>
                  {s.value !== null ? (
                    (s.fmt ?? fmtCompact)(s.value)
                  ) : metrics ? (
                    <StatDash />
                  ) : (
                    "…"
                  )}
                </Stat>
              ))}
            </div>
          </Board>

          {/* who's here */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <ChartSection
              label={`Active Addresses · ${rangeLabel}`}
              action={<OverlayKey label="senders" />}
            >
              {series("activeAddresses", "activeSenders").length ? (
                <DualChart
                  data={series("activeAddresses", "activeSenders")}
                  kind="area"
                  fmt={fmtCompact}
                  aLabel="addresses"
                  bLabel="senders"
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>

            <ChartSection
              label={`Transactions · ${rangeLabel}`}
              action={<OverlayKey label="avg tps" dashed />}
            >
              {series("txCount", "avgTps").length ? (
                <DualChart
                  data={series("txCount", "avgTps")}
                  kind="bars"
                  fmt={fmtCompact}
                  aLabel="txs"
                  bLabel="avg TPS"
                  bFmt={(v) => v.toFixed(1)}
                  bOwnAxis
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>
          </div>

          {/* the long arc */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <ChartSection label={`Total Addresses · ${rangeLabel}`}>
              {series("cumulativeAddresses").length ? (
                <DualChart
                  data={series("cumulativeAddresses")}
                  kind="area"
                  fmt={fmtCompact}
                  aLabel="addresses all-time"
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>

            <ChartSection label={`Total Transactions · ${rangeLabel}`}>
              {series("cumulativeTxCount").length ? (
                <DualChart
                  data={series("cumulativeTxCount")}
                  kind="area"
                  fmt={fmtCompact}
                  aLabel="txs all-time"
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>
          </div>

          {/* what's being built, and what it burns */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <ChartSection
              label={`Contracts Deployed · ${rangeLabel}`}
              action={<OverlayKey label="deployers" dashed />}
            >
              {series("contracts", "deployers").length ? (
                <DualChart
                  data={series("contracts", "deployers")}
                  kind="bars"
                  fmt={fmtCompact}
                  aLabel="contracts"
                  bLabel="deployers"
                  bOwnAxis
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>

            <ChartSection label={`Gas Used · ${rangeLabel}`}>
              {series("gasUsed").length ? (
                <DualChart data={series("gasUsed")} kind="bars" fmt={fmtCompact} aLabel="gas" />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>
          </div>

          {/* the price of blockspace */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <ChartSection label={`Fees Paid · ${rangeLabel}`}>
              {series("feesPaid").length ? (
                <DualChart
                  data={series("feesPaid")}
                  kind="bars"
                  fmt={(v) => `${fmtCompact(v)} ${tokenSymbol}`}
                  aLabel=""
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>

            <ChartSection
              label={`Gas Price · ${rangeLabel}`}
              action={<OverlayKey label="daily max" dashed />}
              note={`Average price paid per gas unit in n${tokenSymbol}; the dashed line is each day's spike, on its own scale.`}
            >
              {series("avgGasPrice", "maxGasPrice").length ? (
                <DualChart
                  data={series("avgGasPrice", "maxGasPrice")}
                  kind="area"
                  fmt={(v) => `${v.toFixed(2)} n${tokenSymbol}`}
                  aLabel="avg"
                  bLabel="max"
                  bFmt={(v) => `${fmtCompact(v)} n${tokenSymbol}`}
                  bOwnAxis
                />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>
          </div>

          {/* cross-chain traffic */}
          <ChartSection
            label={`Interchain Messages · ${rangeLabel}`}
            action={
              chainSlug ? (
                <Link
                  href={`/explorer/mainnet/${chainSlug}/icm`}
                  className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  Routes and live feed
                  <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
                </Link>
              ) : (
                <Link
                  href="/explorer/mainnet/icm"
                  className="group flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  ICM observatory
                  <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
                </Link>
              )
            }
          >
            {icmSeries.length ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={icmSeries} barCategoryGap="22%">
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, "dataMax"]} />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(161,161,170,0.08)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as IcmPoint;
                        return (
                          <TipPlate>
                            <p className="text-[10px] text-zinc-500">{d.date}</p>
                            <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                              {d.incomingCount.toLocaleString()} received
                            </p>
                            <p className="text-[10px] tabular-nums text-zinc-500">
                              {d.outgoingCount.toLocaleString()} sent
                            </p>
                          </TipPlate>
                        );
                      }}
                    />
                    <Bar
                      dataKey="incomingCount"
                      stackId="icm"
                      fill={QUIET}
                      fillOpacity={0.8}
                      minPointSize={1}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="outgoingCount"
                      stackId="icm"
                      fill={PUNCH}
                      fillOpacity={0.75}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty failed={!!metrics} label={metrics ? "No ICM activity" : "Loading…"} />
            )}
          </ChartSection>
        </div>
      )}
    </div>
  );
}
