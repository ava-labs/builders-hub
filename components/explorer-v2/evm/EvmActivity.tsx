"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { fmtCompact, metricSeries, useChainMetrics } from "./metric-charts";

/* What the chain is FOR — the overview's activity breakdown, on the page
 * clock. C-Chain: daily activity classified by on-chain behavior
 * (ClickHouse via /api/cchain-activity?days=…), stacked areas. Other
 * chains: the daily-transactions area off the chain-stats indexer, drawn
 * in the chain's own accent. Either card doors into the Transactions tab.
 * Both render nothing until data exists, so unindexed chains lose no
 * vertical space. */

interface CchainActivityDay {
  date: string;
  defi: number;
  nft: number;
  tokens: number;
  other: number;
}

/* Stack order: biggest band lowest (the /api/cchain-activity contract). */
const ACTIVITY_SERIES: { key: keyof Omit<CchainActivityDay, "date">; label: string; tone: string }[] = [
  { key: "tokens", label: "Tokens", tone: "#A2AFB2" },
  { key: "other", label: "Other", tone: "#d4d4d8" },
  { key: "defi", label: "DeFi", tone: "#E6212F" },
  { key: "nft", label: "NFT", tone: "#52525b" },
];

/* the served window per clock tick: the classification can't afford a
   year (it spills past 90d), and a 1-point day chart says nothing — both
   ends clamp and the label states the exception */
const ACTIVITY_DAYS: Record<ExplorerRange, 7 | 30 | 90> = {
  day: 7,
  week: 7,
  month: 30,
  quarter: 90,
  year: 90,
  all: 90,
};

const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" } as const;

export function CchainActivityChart({ href }: { href?: string }) {
  const clock = useExplorerTimeRange();
  const served = ACTIVITY_DAYS[clock];
  const exception =
    clock === "day"
      ? "· 7 days"
      : clock === "year" || clock === "all"
        ? "· 90 days · longest computed"
        : null;

  const [activity, setActivity] = useState<CchainActivityDay[] | null>(null);
  const [servedDays, setServedDays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cchain-activity?days=${served}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: CchainActivityDay[] } | null) => {
        if (!cancelled && data?.days?.length) {
          setActivity(data.days);
          setServedDays(served);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [served]);

  if (!activity) return null;
  // a window switch keeps the last payload on screen, dimmed, until the
  // new one lands — same idiom as the gas market
  const stale = servedDays !== served;

  return (
    <ChartBoard
      label={exception ? `Network Activity ${exception}` : "Network Activity"}
      href={href}
      className={cn(stale && "opacity-60 transition-opacity")}
      action={
        <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:gap-4 dark:text-zinc-500">
          {ACTIVITY_SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ background: s.tone }} />
              {s.label}
            </span>
          ))}
        </span>
      }
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activity} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              minTickGap={48}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <RechartsTooltip
              cursor={{ stroke: "rgba(161,161,170,0.3)" }}
              content={({ active: a, payload }) => {
                if (!a || !payload?.length) return null;
                const d = payload[0].payload as CchainActivityDay;
                const total = d.defi + d.nft + d.tokens + d.other;
                return (
                  <TipPlate>
                    <p className="text-[10px] text-zinc-500">
                      {d.date} · {total.toLocaleString()} txns
                    </p>
                    {ACTIVITY_SERIES.map((s) => (
                      <p
                        key={s.key}
                        className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-900 dark:text-zinc-100"
                      >
                        <span className="h-1.5 w-1.5" style={{ background: s.tone }} />
                        {d[s.key].toLocaleString()} {s.label.toLowerCase()}
                        <span className="text-[10px] text-zinc-400">
                          {total > 0 ? `${((d[s.key] / total) * 100).toFixed(0)}%` : ""}
                        </span>
                      </p>
                    ))}
                  </TipPlate>
                );
              }}
            />
            {ACTIVITY_SERIES.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                stackId="day"
                stroke={s.tone}
                strokeWidth={1}
                fill={s.tone}
                fillOpacity={0.85}
                type="monotone"
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartBoard>
  );
}

// the history charts ride the chain-stats indexer, which serves any clock
const TX_METRICS = "txCount";

export function TxHistoryChart({ chainId, href }: { chainId: number | string; href?: string }) {
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // a 1-point day chart says nothing — floor at a week, label the exception
  const windowDays = Math.max(7, range);
  const { metrics } = useChainMetrics(String(chainId), windowDays, TX_METRICS);

  const history = useMemo(
    () => metricSeries(metrics ?? {}, windowDays, "txCount"),
    [metrics, windowDays],
  );

  if (!history.length) return null;

  return (
    <ChartBoard label={clock === "day" ? "Transactions · 7 days" : "Transactions"} href={href}>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              minTickGap={48}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <RechartsTooltip
              cursor={{ stroke: "rgba(161,161,170,0.3)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as { date: string; a: number };
                return (
                  <TipPlate>
                    <p className="text-[10px] text-zinc-500">{d.date}</p>
                    <p className="text-xs font-semibold tabular-nums text-[var(--chain-accent,#E6212F)]">
                      {fmtCompact(d.a)} txns
                    </p>
                  </TipPlate>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="a"
              stroke="var(--chain-accent, #E6212F)"
              strokeWidth={1.5}
              fill="var(--chain-accent, #E6212F)"
              fillOpacity={0.08}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: "var(--chain-accent, #E6212F)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartBoard>
  );
}
