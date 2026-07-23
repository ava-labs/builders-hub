"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";

/* What the chain is FOR — ported from the pre-EvmHome overview
 * (components/explorer/L1ExplorerPage.tsx). C-Chain: 14 days of activity
 * classified by on-chain behavior (ClickHouse via /api/cchain-activity),
 * stacked areas. Other chains: the plain daily-transactions line
 * (ClickHouse via /api/explorer/{chainId}?historyOnly=true), drawn in the
 * chain's own accent. Either section renders nothing until data exists, so
 * unindexed chains lose no vertical space. */

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

export function CchainActivityChart() {
  const [activity, setActivity] = useState<CchainActivityDay[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cchain-activity")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: CchainActivityDay[] } | null) => {
        if (!cancelled && data?.days?.length) setActivity(data.days);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!activity) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Network Activity · 14 days"
        action={
          <span className="flex shrink-0 items-center gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {ACTIVITY_SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ background: s.tone }} />
                {s.label}
              </span>
            ))}
          </span>
        }
      />
      <Board divide={false} className="px-5 py-5 md:px-6">
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity}>
              <YAxis hide domain={[0, "dataMax"]} />
              <RechartsTooltip
                cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                content={({ active: a, payload }) => {
                  if (!a || !payload?.length) return null;
                  const d = payload[0].payload as CchainActivityDay;
                  const total = d.defi + d.nft + d.tokens + d.other;
                  return (
                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 shadow-sm">
                      <p className="text-[10px] text-zinc-500">
                        {d.date} · {total.toLocaleString()} txns
                      </p>
                      {ACTIVITY_SERIES.map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
                          <span className="h-1.5 w-1.5" style={{ background: s.tone }} />
                          {d[s.key].toLocaleString()} {s.label.toLowerCase()}
                        </p>
                      ))}
                    </div>
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
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Board>
    </section>
  );
}

interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

export function TxHistoryChart({ chainId }: { chainId: number | string }) {
  const [history, setHistory] = useState<TransactionHistoryPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/explorer/${chainId}?historyOnly=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { transactionHistory: TransactionHistoryPoint[] } | null) => {
        if (!cancelled && data?.transactionHistory?.length) setHistory(data.transactionHistory);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  if (!history) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Transactions · 14 days"
        action={
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {history[0]?.date} → {history[history.length - 1]?.date}
          </span>
        }
      />
      <Board divide={false} className="px-5 py-5 md:px-6">
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 shadow-sm">
                      <p className="text-[10px] text-zinc-500">{payload[0].payload.date}</p>
                      <p className="text-xs font-semibold text-[var(--chain-accent,#E6212F)]">
                        {payload[0].value?.toLocaleString()} txns
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="transactions"
                stroke="var(--chain-accent, #E6212F)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: "var(--chain-accent, #E6212F)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Board>
    </section>
  );
}
