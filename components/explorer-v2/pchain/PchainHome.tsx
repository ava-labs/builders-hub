"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import {
  Board,
  BoardHeader,
  ChartBoard,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
  TxTypePill,
  idInk,
  txToneText,
} from "@/components/explorer-v2/ui";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  usePrimaryMetrics,
  toSeries,
  fmtCompact,
  NANO,
  type SeriesPoint,
} from "@/components/explorer-v2/staking/data";
import { formatAvax, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { txTypeLabel, type Stats, type TxSummary, type BlockSummary } from "@/lib/pchain-explorer";

/* The /api/pchain-activity contract: staking money-flow, not tx counts.
   Rewards paid ride red (stake moving = the chain alive); stake about to
   unlock rides block gray (value at rest, waiting). */
interface RewardDay {
  date: string;
  avax: number;
  payouts: number;
}
interface UnlockDay {
  date: string;
  avax: number;
  stakers: number;
}
interface StakingSeries {
  rewards: RewardDay[];
  unlocks: UnlockDay[];
}

const fmtAvaxShort = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${Math.round(n)}`;

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
/* Chain Stats — the P-Chain's readings in the C-Chain board grammar:
   bordered plate, fused CHAIN STATS title bar, uniform figure grid.
   The figures are levels (stake, supply, seat counts), not flows, so
   the window reading is the level's move against N days ago. On
   mainnet the title carries the page clock and the staking figures
   their move; other networks get the same plate without the window
   voice — the metrics feed is mainnet-only. */

const FIG =
  "min-w-0 whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";

interface StatDef {
  label: string;
  href?: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}

/* a level's move over the window: last daily close vs N days before it,
   in the metric's own unit — absolute heads, not percents */
function levelDiff(points: SeriesPoint[], n: number): number | null {
  const cur = points[points.length - 1];
  // a window wider than the history (the ALL tick) reads from the first
  // point: the diff becomes "since the series began"
  const prev = points[Math.max(0, points.length - 1 - n)];
  if (!cur || !prev || cur === prev) return null;
  return cur.value - prev.value;
}

/* the Etherscan parenthetical in absolute units — the evm Delta chip's
   voice, but "+327" / "-12.4K AVAX" instead of a percent */
function DeltaAbs({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
      {up ? "+" : "-"}
      {fmtCompact(Math.abs(value))}
      {unit ? ` ${unit}` : ""} vs prev
    </span>
  );
}

function buildStatCells(
  s: Stats | null,
  totalStake: number | null,
  stakingRatio: number | null,
  base: string,
  subs?: {
    staked?: React.ReactNode;
    delegators?: React.ReactNode;
    validators?: React.ReactNode;
  },
): StatDef[] {
  const avax = (v: number | string) => (
    <span className={FIG}>
      {formatAvax(v, { compact: true, symbol: false })}
      <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
    </span>
  );
  return [
    {
      label: "Total Staked",
      href: `${base}/staking/total-stake`,
      value: totalStake ? avax(totalStake) : <StatDash />,
      sub: subs?.staked,
    },
    {
      // denominator is the TOTAL SUPPLY cell beside it — the two read
      // as one statement
      label: "Staked · of Total Supply",
      value:
        stakingRatio !== null ? (
          <span className={FIG}>
            {stakingRatio.toFixed(1)}
            <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
          </span>
        ) : (
          <StatDash />
        ),
    },
    {
      label: "Total Supply",
      value: s?.currentSupply ? avax(s.currentSupply) : <StatDash />,
    },
    {
      label: "Delegators",
      href: `${base}/staking/total-stake`,
      value: s ? <StatFigure value={s.delegatorCount} className="md:text-2xl" /> : <StatDash />,
      sub: subs?.delegators,
    },
    {
      label: "Primary Validators",
      href: `${base}/validators`,
      value: s ? <StatFigure value={s.validatorCount} className="md:text-2xl" /> : <StatDash />,
      sub: subs?.validators,
    },
    {
      label: "L1 Validators",
      href: `${base}/validators`,
      value: s ? <StatFigure value={s.l1ValidatorCount} className="md:text-2xl" /> : <StatDash />,
    },
  ];
}

/* the plate itself — EvmOverviewStats' frame with two rows of three:
   the money row (stake against supply), then the participants row */
function ChainStatsBoard({ cells, action }: { cells: StatDef[]; action?: React.ReactNode }) {
  const grid =
    "grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-3 lg:divide-y-0 dark:divide-zinc-800";
  const row = (slice: StatDef[]) =>
    slice.map((c) => (
      <StatCell key={c.label} label={c.label} href={c.href} sub={c.sub}>
        {c.value}
      </StatCell>
    ));
  return (
    <Board divide={false} className="border">
      <BoardHeader label="Chain Stats" display action={action} />
      <div className={`${grid} border-b border-zinc-200 dark:border-zinc-800`}>
        {row(cells.slice(0, 3))}
      </div>
      <div className={grid}>{row(cells.slice(3))}</div>
    </Board>
  );
}

/* mainnet: the board rides the page clock — the subnav range control
   appears because this registers as a consumer, exactly like the
   C-Chain's Chain Stats */
function MainnetChainStats({
  s,
  totalStake,
  stakingRatio,
  base,
}: {
  s: Stats | null;
  totalStake: number | null;
  stakingRatio: number | null;
  base: string;
}) {
  const clock = useExplorerTimeRange();
  const n = RANGE_DAYS[clock];
  const { data: metrics } = usePrimaryMetrics();

  const moves = useMemo(() => {
    if (!metrics) return null;
    const own = toSeries(metrics.validator_weight);
    const delegated = new Map(toSeries(metrics.delegator_weight).map((p) => [p.day, p.value]));
    const staked = own.map((p) => ({ day: p.day, value: p.value + (delegated.get(p.day) ?? 0) }));
    // the weight series ride in nAVAX — the head converts so the chip
    // speaks the same unit as the figure above it
    const stakedDiff = levelDiff(staked, n);
    return {
      staked: stakedDiff === null ? null : stakedDiff / NANO,
      delegators: levelDiff(toSeries(metrics.delegator_count), n),
      validators: levelDiff(toSeries(metrics.validator_count), n),
    };
  }, [metrics, n]);

  const sub = (v: number | null | undefined, unit?: string) =>
    v == null ? undefined : <DeltaAbs value={v} unit={unit} />;

  return (
    <ChainStatsBoard
      action={
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
          {rangeWindowLabel(clock)}
        </span>
      }
      cells={buildStatCells(s, totalStake, stakingRatio, base, {
        staked: sub(moves?.staked, "AVAX"),
        delegators: sub(moves?.delegators),
        validators: sub(moves?.validators),
      })}
    />
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
  const { subnets } = useValidatorStats(network);
  const totalStake = useMemo(() => {
    const primary = subnets?.find((sub) => sub.id === PRIMARY_SUBNET_ID);
    return primary?.totalStakeString ? Number(primary.totalStakeString) : null;
  }, [subnets]);

  const supply = s?.currentSupply ? Number(s.currentSupply) : null;
  const stakingRatio = totalStake && supply ? (totalStake / supply) * 100 : null;

  // staking money-flow: rewards paid (last 14d) and stake unlocking (next
  // 14d). The section simply doesn't render without aggregate data.
  const [staking, setStaking] = useState<StakingSeries | null>(null);
  useEffect(() => {
    let cancelled = false;
    setStaking(null);
    fetch(`/api/pchain-activity/${network}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StakingSeries | null) => {
        if (!cancelled && data?.rewards?.length) setStaking(data);
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
              Chain Height
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

            {/* the board is the P-Chain's actual job: staking. Activity
                already lives in the tape above. Same instrument grammar
                as the C-Chain's Chain Stats — window tag and moves ride
                the page clock where the mainnet metrics feed reaches. */}
            {network === "mainnet" ? (
              <MainnetChainStats
                s={s}
                totalStake={totalStake}
                stakingRatio={stakingRatio}
                base={base}
              />
            ) : (
              <ChainStatsBoard cells={buildStatCells(s, totalStake, stakingRatio, base)} />
            )}
          </div>

          {/* staking money-flow: the 30 days behind us in rewards paid out
              (red: stake moving) beside the 30 days ahead in stake coming
              unlocked (block gray: value at rest, waiting). Past | future
              across one rule; each card doors into its staking sheet.
              Fixed windows from the feed — the labels say so. */}
          {staking && (
            <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
              <ChartBoard
                label="Rewards Paid · last 30 days"
                href={`${base}/staking/rewards`}
                className="min-w-0"
                action={
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {fmtAvaxShort(staking.rewards.reduce((s, d) => s + d.avax, 0))} AVAX
                  </span>
                }
              >
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staking.rewards} barCategoryGap="18%">
                      <YAxis hide domain={[0, "dataMax"]} />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(161,161,170,0.08)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as RewardDay;
                          return (
                            <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                              <p className="text-[10px] text-zinc-500">{d.date}</p>
                              <p className="text-xs font-semibold tabular-nums text-[#E6212F]">
                                {Math.round(d.avax).toLocaleString()} AVAX
                              </p>
                              <p className="text-[10px] tabular-nums text-zinc-500">
                                {d.payouts.toLocaleString()} payouts
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="avax" fill="#E6212F" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBoard>

              <ChartBoard
                label="Stake Expiring · next 30 days"
                href={`${base}/staking/expiry`}
                className="min-w-0"
                action={
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {fmtAvaxShort(staking.unlocks.reduce((s, d) => s + d.avax, 0))} AVAX
                  </span>
                }
              >
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staking.unlocks} barCategoryGap="18%">
                      <YAxis hide domain={[0, "dataMax"]} />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(161,161,170,0.08)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as UnlockDay;
                          return (
                            <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                              <p className="text-[10px] text-zinc-500">{d.date}</p>
                              <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                {d.avax.toLocaleString()} AVAX
                              </p>
                              <p className="text-[10px] tabular-nums text-zinc-500">
                                {d.stakers.toLocaleString()} stake entries end
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="avax" fill="#A2AFB2" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBoard>
            </div>
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
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem_3.5rem] md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className={`font-mono text-[13px] tabular-nums ${idInk}`}>
                      #{formatNumber(b.blockNumber)}
                    </span>
                    <span className="min-w-0 text-left">
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
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.75rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className={`truncate font-mono text-[12px] ${idInk}`}>
                      {truncate(t.txHash, 22)}
                    </span>
                    <span className="min-w-0 text-left">
                      <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
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
              href="/explorer/mainnet"
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
