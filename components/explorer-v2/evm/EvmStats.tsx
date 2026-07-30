"use client";

import { useMemo } from "react";
import {
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Board, BoardHeader, StatDash } from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat, TipPlate } from "@/components/explorer-v2/staking/bits";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  ChartSection,
  Delta,
  DualChart,
  OverlayKey,
  PUNCH,
  QUIET,
  fmtCompact,
  metricSeries,
  pctOf,
  useChainMetrics,
  weekFloor,
  windowPair,
  type DualPoint,
  type IcmPoint,
} from "./metric-charts";

/* The network-wide Stats surface (chainId="all") — the metrics sheet in
   the gas page's grammar: a readings board on the shared clock with each
   figure's move against the previous window, then outlined chart cards.
   Every chart pairs its headline series with the overlay that explains it
   (senders under addresses, TPS over transactions, max gas price against
   the average). Per-chain, these charts live on their subject tabs
   instead: Accounts, Transactions, Gas, ICM. */

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

export function EvmStats({
  chainId,
  tokenSymbol = "AVAX",
}: {
  /** EVM chain id, or "all" for the network-wide aggregate */
  chainId: string;
  tokenSymbol?: string;
}) {
  // the page clock in the subnav — every chart and figure below rides it
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const rangeLabel = rangeWindowLabel(clock);
  // fetch double the window so every reading can face its previous window
  const { metrics, failed } = useChainMetrics(chainId, Math.min(range * 2, 365), METRICS);

  const m = metrics ?? {};
  const series = (key: string, overlay?: string): DualPoint[] => metricSeries(m, range, key, overlay);
  const win = (key: string, mode: "sum" | "avg" = "sum") => windowPair(m[key]?.data, range, mode);

  const icmSeries = useMemo(() => {
    const pts = metrics?.icmMessages?.data ?? [];
    return thin(
      windowSeries(
        [...pts].sort((a, b) => a.timestamp - b.timestamp),
        Math.max(7, range),
      ),
      200,
    );
  }, [metrics, range]);

  // the readings row: the clock's window against the window before it —
  // sums for volumes, means for rates. No per-cell window labels; the
  // board header states it once.
  const strip: {
    label: string;
    pair: ReturnType<typeof win>;
    fmt?: (v: number) => string;
    sub?: string;
  }[] = [
    {
      label: "Transactions",
      pair: win("txCount"),
      sub: (() => {
        const tps = win("avgTps", "avg");
        return tps ? `avg ${tps.cur.toFixed(1)} TPS` : undefined;
      })(),
    },
    {
      label: "Active Addresses",
      pair: win("activeAddresses", "avg"),
      sub: range > 1 ? "daily avg" : undefined,
    },
    {
      label: "Fees Paid",
      pair: win("feesPaid"),
      fmt: (v) => `${fmtCompact(v)} ${tokenSymbol}`,
      sub: (() => {
        const gp = win("avgGasPrice", "avg");
        return gp ? `avg gas ${gp.cur.toFixed(2)} n${tokenSymbol}` : undefined;
      })(),
    },
    {
      label: "Contracts Deployed",
      pair: win("contracts"),
      sub: (() => {
        const d = win("deployers");
        return d ? `${fmtCompact(d.cur)} deployers` : undefined;
      })(),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {failed ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6212F]">
            Failed to load chain metrics
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* the window is stated once, up here — everything below follows
              the same clock unless its label says otherwise */}
          <Board divide={false} className="border">
            <BoardHeader
              label="Network Stats"
              display
              action={
                <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  {rangeLabel}
                </span>
              }
            />
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
              {strip.map((s) => (
                <Stat
                  key={s.label}
                  label={s.label}
                  sub={
                    s.pair ? (
                      <>
                        {s.sub ? <>{s.sub} · </> : null}
                        <Delta value={pctOf(s.pair)} />
                      </>
                    ) : (
                      s.sub
                    )
                  }
                >
                  {s.pair !== null ? (
                    (s.fmt ?? fmtCompact)(s.pair.cur)
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
              label={`Active Addresses${weekFloor(range)}`}
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
              label={`Transactions${weekFloor(range)}`}
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
            <ChartSection label={`Total Addresses${weekFloor(range)}`}>
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

            <ChartSection label={`Total Transactions${weekFloor(range)}`}>
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
              label={`Contracts Deployed${weekFloor(range)}`}
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

            <ChartSection label={`Gas Used${weekFloor(range)}`}>
              {series("gasUsed").length ? (
                <DualChart data={series("gasUsed")} kind="bars" fmt={fmtCompact} aLabel="gas" />
              ) : (
                <ChartEmpty failed={!!metrics} />
              )}
            </ChartSection>
          </div>

          {/* the price of blockspace */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <ChartSection label={`Fees Paid${weekFloor(range)}`}>
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
              label={`Gas Price${weekFloor(range)}`}
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

          {/* cross-chain traffic — the whole card doors into the observatory */}
          <ChartSection
            label={`Interchain Messages${weekFloor(range)}`}
            href="/explorer/mainnet/icm"
            action={
              <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 bg-[#A2AFB2]/80" /> received
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-4 bg-[#E6212F]/75" /> sent
                </span>
              </span>
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
