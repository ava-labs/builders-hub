"use client";

import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
  TxTypePill,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import type { Stats, TxSummary, BlockSummary } from "@/lib/pchain-explorer";

export function PchainHome({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const live = { refreshMs: LIVE_REFRESH_MS };
  const stats = usePchainData<Stats>(network, "stats", undefined, live);
  const txs = usePchainData<TxSummary[]>(network, "txs", { limit: 8 }, live);
  const blocks = usePchainData<{ blocks: BlockSummary[] }>(network, "blocks", { limit: 8 }, live);

  const s = stats.data;
  const noData = !stats.loading && (stats.error === "not found" || (s && s.tipHeight === 0));

  return (
    <ExplorerShell chain={chain} network={network}>
      {noData ? (
        <Board divide={false} className="px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No data indexed yet for this network
          </p>
        </Board>
      ) : (
        <div className="flex flex-col gap-12">
          {/* Stats strip */}
          <Board divide={false}>
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0 dark:divide-zinc-800">
              <StatCell label="TIP HEIGHT" live href={`${base}/blocks`}>
                {s ? <StatFigure value={s.tipHeight} /> : <StatDash />}
              </StatCell>
              <StatCell label="TXNS · 24H" live href={`${base}/txs`}>
                {s ? <StatFigure value={s.txCount24h} /> : <StatDash />}
              </StatCell>
              <StatCell label="VALIDATORS" href={`${base}/validators`}>
                {s ? <StatFigure value={s.validatorCount} /> : <StatDash />}
              </StatCell>
              <StatCell label="DELEGATORS">
                {s ? <StatFigure value={s.delegatorCount} /> : <StatDash />}
              </StatCell>
              <StatCell label="L1 VALIDATORS">
                {s ? <StatFigure value={s.l1ValidatorCount} /> : <StatDash />}
              </StatCell>
              <StatCell label="CURRENT SUPPLY">
                {s?.currentSupply ? (
                  <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 md:text-2xl dark:text-zinc-50">
                    {formatAvax(s.currentSupply, { compact: true })}
                  </span>
                ) : (
                  <StatDash />
                )}
              </StatCell>
            </div>
          </Board>

          <div className="grid gap-12 lg:grid-cols-2">
            {/* Latest blocks */}
            <section className="flex flex-col gap-4">
              <SectionHeader
                label="Latest Blocks"
                action={
                  <Link
                    href={`${base}/blocks`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                  >
                    View all →
                  </Link>
                }
              />
              <Board>
                {blocks.loading && <RowSkeleton n={8} />}
                {blocks.data?.blocks?.map((b) => (
                  <Link
                    key={b.blockNumber}
                    href={`${base}/block/${b.blockNumber}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        #{formatNumber(b.blockNumber)}
                      </span>
                      <TxTypePill type={b.blockType.replace(/Block$/, "")} />
                    </div>
                    <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>{b.txCount} tx</span>
                      <span className="w-16 text-right tabular-nums">{timeAgo(b.blockTimestamp)}</span>
                    </div>
                  </Link>
                ))}
              </Board>
            </section>

            {/* Latest transactions */}
            <section className="flex flex-col gap-4">
              <SectionHeader
                label="Latest Transactions"
                action={
                  <Link
                    href={`${base}/txs`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                  >
                    View all →
                  </Link>
                }
              />
              <Board>
                {txs.loading && <RowSkeleton n={8} />}
                {txs.data?.map((t) => (
                  <Link
                    key={t.txHash}
                    href={`${base}/tx/${t.txHash}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                        {t.txHash.slice(0, 10)}…
                      </span>
                      <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(t.blockTimestamp)}
                    </span>
                  </Link>
                ))}
              </Board>
            </section>
          </div>
        </div>
      )}
    </ExplorerShell>
  );
}

function RowSkeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-3 md:px-6">
          <div className="h-3 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-12 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </>
  );
}
