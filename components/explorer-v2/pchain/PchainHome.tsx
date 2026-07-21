"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import {
  Board,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
  TxTypePill,
  txToneText,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import type { Stats, TxSummary, BlockSummary } from "@/lib/pchain-explorer";

/* "BanffCommitBlock" → "Commit": the Banff prefix is a protocol-upgrade
   implementation detail; Commit/Proposal/Standard is what the reader needs. */
function blockKind(blockType: string): string {
  return blockType.replace(/^Banff/, "").replace(/Block$/, "");
}

function LiveDot({ onRed = false, className }: { onRed?: boolean; className?: string }) {
  const tone = onRed ? "bg-white" : "bg-[#E6212F]";
  return (
    <span className={cn("relative flex h-1.5 w-1.5", className)}>
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", tone)} />
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", tone)} />
    </span>
  );
}


/* ------------------------------------------------------------------ */

export function PchainHome({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  // the page is an instrument panel, not a report — txs/blocks poll live;
  // stats move slowly so they poll at half the cadence
  const live = { refreshMs: LIVE_REFRESH_MS };
  const stats = usePchainData<Stats>(network, "stats", undefined, { refreshMs: LIVE_REFRESH_MS * 2 });
  const txs = usePchainData<TxSummary[]>(network, "txs", { limit: 8 }, live);
  // one blocks fetch feeds both the tape (all 20) and the list (first 8)
  const blocks = usePchainData<{ blocks: BlockSummary[] }>(
    network,
    "blocks",
    { limit: 20 },
    live,
  );

  const s = stats.data;

  // total AVAX staked on the Primary Network — the strip is a staking
  // dashboard, and the ratio against supply is its headline
  const [totalStake, setTotalStake] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/validator-stats?network=${network}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((subnets: { id: string; totalStakeString?: string }[] | null) => {
        if (cancelled || !subnets) return;
        const primary = subnets.find((sub) => sub.id === PRIMARY_SUBNET_ID);
        if (primary?.totalStakeString) setTotalStake(Number(primary.totalStakeString));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [network]);

  const supply = s?.currentSupply ? Number(s.currentSupply) : null;
  const stakingRatio = totalStake && supply ? (totalStake / supply) * 100 : null;

  // 14-day tx history — the C-Chain overview's chart grammar; the section
  // simply doesn't render for networks without aggregate data (devnet)
  const [history, setHistory] = useState<{ date: string; transactions: number }[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    fetch(`/api/pchain-activity/${network}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: { date: string; transactions: number }[] } | null) => {
        if (!cancelled && data?.days?.length) setHistory(data.days);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [network]);

  const tape = blocks.data?.blocks ?? [];
  const tapeBlocks: TapeBlock[] = tape.map((b) => {
    const kind = blockKind(b.blockType);
    return {
      key: String(b.blockNumber),
      number: formatNumber(b.blockNumber),
      txCount: b.txCount,
      label: kind,
      labelClass: txToneText(kind),
      ago: timeAgo(b.blockTimestamp),
      href: `${base}/block/${b.blockNumber}`,
    };
  });
  const noData = !stats.loading && (stats.error === "not found" || (s && s.tipHeight === 0));

  return (
    <ExplorerShell
      chain={chain}
      network={network}
      aside={
        s && !noData ? (
          <Link href={`${base}/blocks`} className="group flex flex-col items-end gap-1.5">
            <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              <LiveDot />
              Tip Height
            </span>
            <StatFigure
              value={s.tipHeight}
              className="text-3xl transition-colors group-hover:text-[#E6212F] md:text-[2.5rem]"
            />
          </Link>
        ) : undefined
      }
    >
      {noData ? (
        <Board divide={false} className="px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No data indexed yet for this network
          </p>
        </Board>
      ) : (
        <div className="flex flex-col gap-12">
          {/* instrument cluster: live block tape over the ledger strip */}
          <div className="flex flex-col gap-4">
            {blocks.loading && !tape.length ? (
              <BlockTapeSkeleton />
            ) : (
              tapeBlocks.length > 0 && <BlockTape blocks={tapeBlocks} />
            )}

            {/* the strip is the P-Chain's actual job: staking. Activity
                already lives in the tape above. */}
            <Board divide={false}>
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0 dark:divide-zinc-800">
                <StatCell label="STAKING RATIO">
                  {stakingRatio !== null ? (
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {stakingRatio.toFixed(1)}
                      <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                <StatCell label="TOTAL STAKED">
                  {totalStake ? (
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {formatAvax(totalStake, { compact: true, symbol: false })}
                      <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                <StatCell label="PRIMARY VALIDATORS" href={`${base}/validators`}>
                  {s ? <StatFigure value={s.validatorCount} /> : <StatDash />}
                </StatCell>
                <StatCell label="L1 VALIDATORS">
                  {s ? <StatFigure value={s.l1ValidatorCount} /> : <StatDash />}
                </StatCell>
                <StatCell label="DELEGATORS">
                  {s ? <StatFigure value={s.delegatorCount} /> : <StatDash />}
                </StatCell>
                <StatCell label="TOTAL SUPPLY">
                  {s?.currentSupply ? (
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {formatAvax(s.currentSupply, { compact: true, symbol: false })}
                      <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
              </div>
            </Board>
          </div>

          {/* transaction history — the same red-line instrument the C-Chain
              overview uses to breathe between the strip and the live boards */}
          {history && (
            <section className="flex flex-col gap-4">
              <SectionHeader
                label="Transactions · 14 days"
                action={
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {history[0]?.date} — {history[history.length - 1]?.date}
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
                            <div className="border border-zinc-200 bg-white px-2 py-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                              <p className="text-[10px] text-zinc-500">{payload[0].payload.date}</p>
                              <p className="text-xs font-semibold text-[#E6212F]">
                                {payload[0].value?.toLocaleString()} txns
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="transactions"
                        stroke="#E6212F"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, fill: "#E6212F" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Board>
            </section>
          )}

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
                {blocks.loading && !tape.length && <RowSkeleton n={8} />}
                {tape.slice(0, 8).map((b) => (
                  <Link
                    key={b.blockNumber}
                    href={`${base}/block/${b.blockNumber}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[6.5rem_minmax(0,1fr)_2.5rem_3.5rem] md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      #{formatNumber(b.blockNumber)}
                    </span>
                    <span className="min-w-0 text-right md:text-left">
                      <TxTypePill type={blockKind(b.blockType)} />
                    </span>
                    <span className="hidden text-right font-mono text-[11px] tabular-nums text-zinc-500 md:block dark:text-zinc-400">
                      {b.txCount} tx
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(b.blockTimestamp)}
                    </span>
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
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_3.5rem] md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_3.5rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                      {truncate(t.txHash, 22)}
                    </span>
                    <span className="min-w-0 text-right">
                      <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(t.blockTimestamp)}
                    </span>
                  </Link>
                ))}
              </Board>
            </section>
          </div>

          {/* red band — the sanctioned solid-red divider, closing the sheet
              with the hand-off to the network observatory (StoryHome idiom) */}
          {network === "mainnet" && (
            <Link
              href="/stats/overview"
              className="group relative flex items-center justify-between overflow-hidden bg-[#E6212F] px-5 py-5 md:px-6"
            >
              <span
                aria-hidden
                className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
              />
              <span className="relative z-10 text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">
                Track the full network
              </span>
              <ArrowRight className="relative z-10 h-4 w-4 text-white transition-colors duration-300 group-hover:text-[#E6212F]" />
            </Link>
          )}
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
