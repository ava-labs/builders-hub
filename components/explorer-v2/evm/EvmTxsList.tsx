"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { ChartEmpty } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { MethodChip } from "./bits";
import { StatusPill } from "./EvmTx";
import { useEvmData, LIVE_REFRESH_MS } from "./hooks";
import {
  ChartSection,
  DualChart,
  OverlayKey,
  fmtCompact,
  metricSeries,
  weekFloor,
  useChainMetrics,
} from "./metric-charts";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { TxListResponse } from "@/lib/evm-explorer";

// The upstream API clamps limit at 100; a recent-activity list of the newest
// 100 txs with live refresh mirrors the P-chain list UX.
const PAGE = 25;
const MAX = 100;

// the history charts under the feed — absorbed from the old Stats tab
const METRICS = ["txCount", "avgTps", "cumulativeTxCount"].join(",");

export function EvmTxsList({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;
  const [limit, setLimit] = useState(PAGE);
  const { data, loading } = useEvmData<TxListResponse>(c.chainId, "txs", { limit }, { refreshMs: LIVE_REFRESH_MS });
  const txs = data?.transactions ?? [];

  // the feed is the page's live half; the charts below give it its shape,
  // on the page clock
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const { metrics, failed } = useChainMetrics(c.chainId, range, METRICS);
  const m = metrics ?? {};

  return (
    <EvmShell network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" />
        <Board className={cn(loading && txs.length > 0 && "opacity-60 transition-opacity")}>
          <div className="hidden grid-cols-[1.4fr_8rem_1.5fr_0.9fr_0.7fr_5rem] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Hash</span>
            <span>Method</span>
            <span>From → To</span>
            <span className="text-right">Value</span>
            <span className="text-right">Age</span>
            <span className="text-right">Status</span>
          </div>
          {txs.map((t) => (
            <Link
              key={t.hash}
              href={`${base}/tx/${t.hash}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.4fr_8rem_1.5fr_0.9fr_0.7fr_5rem] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className={`truncate font-mono text-[12px] ${idInk}`}>
                {truncate(t.hash, 18)}
              </span>
              <span className="min-w-0">
                <CellLabel>Method</CellLabel>
                <MethodChip t={t} />
              </span>
              <span className="min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                <CellLabel>From → To</CellLabel>
                {truncate(t.from, 8)} → {t.to ? truncate(t.to, 8) : "contract"}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Value</CellLabel>
                {formatEther(t.value, { symbol: sym })}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {timeAgo(t.timestamp)}
              </span>
              <span className="justify-self-start md:justify-self-end">
                <StatusPill success={t.success} />
              </span>
            </Link>
          ))}
          {loading && txs.length === 0 && (
            <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>
          )}
          {!loading && txs.length === 0 && (
            <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
              no transactions
            </div>
          )}
        </Board>
        {!loading && txs.length >= limit && limit < MAX && (
          <button
            onClick={() => setLimit((l) => Math.min(l + PAGE, MAX))}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
      </section>

      {/* the shape of the feed over time — absorbed from the old Stats tab */}
      <div className="mt-10 grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartSection
          label={`Transactions${weekFloor(range)}`}
          action={<OverlayKey label="avg tps" dashed />}
        >
          {metricSeries(m, range, "txCount", "avgTps").length ? (
            <DualChart
              data={metricSeries(m, range, "txCount", "avgTps")}
              kind="bars"
              fmt={fmtCompact}
              aLabel="txs"
              bLabel="avg TPS"
              bFmt={(v) => v.toFixed(1)}
              bOwnAxis
            />
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartSection>

        <ChartSection label={`Total Transactions${weekFloor(range)}`}>
          {metricSeries(m, range, "cumulativeTxCount").length ? (
            <DualChart
              data={metricSeries(m, range, "cumulativeTxCount")}
              kind="area"
              fmt={fmtCompact}
              aLabel="txs all-time"
            />
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartSection>
      </div>
    </EvmShell>
  );
}
