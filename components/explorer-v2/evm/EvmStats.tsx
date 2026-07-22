"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  ChartSection,
  DualChart,
  OverlayKey,
  PUNCH,
  QUIET,
  fmtCompact,
  metricSeries,
  num,
  useChainMetrics,
  type DualPoint,
  type IcmPoint,
} from "./metric-charts";

/* The network-wide Stats surface (chainId="all") — the metrics sheet in
   Boards on one shared clock. Every chart pairs its headline series with
   the overlay that explains it (senders under addresses, TPS over
   transactions, max gas price against the average). Per-chain, these
   charts live on their subject tabs instead: Accounts, Transactions,
   Gas, ICM. */

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
  chainSlug,
  tokenSymbol = "AVAX",
}: {
  /** EVM chain id, or "all" for the network-wide aggregate */
  chainId: string;
  chainSlug?: string;
  tokenSymbol?: string;
}) {
  // the page clock in the subnav — every chart and label below rides it
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const rangeLabel = RANGE_LABEL[clock];
  const { metrics, failed } = useChainMetrics(chainId, range, METRICS);

  const m = metrics ?? {};
  const series = (key: string, overlay?: string): DualPoint[] => metricSeries(m, range, key, overlay);

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
    <div className="flex flex-col gap-10">
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
            <BoardHeader label="Latest Day" />
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
