"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { ColumnsBlock, type Col } from "@/components/explorer-v2/gas/instruments";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { usePolledJson, useRememberedJson } from "@/components/explorer-v2/page-data";
import { levelWindow, usePrimaryHistory, type DayPoint } from "@/components/explorer-v2/network/overview-series";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { ROWS } from "@/components/explorer-v2/evm/belt";
import { dayLong, dayShort } from "@/components/explorer-v2/format";
import { useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { L1Versions } from "@/components/explorer-v2/network/l1-versions";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { pchainActivityPath, pchainL1OpsPath, type BlockSummary, type BlocksList, type Stats, type TxSummary } from "@/lib/pchain-explorer";
import { LIVE_REFRESH_MS, usePchainData } from "./hooks";
import { LatestPchainBlocks, LatestPchainTxs } from "./boards";

/* The /api/pchain-activity contract: staking money flow, not tx counts */
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

/* the part of the /api/pchain-l1-ops contract the home reads: each day's
   conversions, and the conversions to date by month */
interface L1Ops {
  ops: { date: string; convert: number }[];
  conversions: { month: string; cumulative: number }[];
}

/* Sub-unit totals are real on Fuji: 30 days of staking rewards there is
   ~0.42 AVAX, and a rounded figure would print "0 AVAX" over a full chart */
const fmtAvaxShort = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : n >= 1
        ? `${Math.round(n)}`
        : n > 0
          ? n < 0.0001
            ? "<0.0001"
            : `${Number(n.toPrecision(2))}`
          : "0";

const NO_BLOCKS: BlockSummary[] = [];
const NO_TXS: TxSummary[] = [];
const NO_MOVE: { spark?: number[]; delta: number | null } = { delta: null };

/* ------------------------------------------------------------------ */
/* The readouts: the P-Chain's job is staking and L1s. On mainnet each
   level moves against the page clock's window and draws its days; the
   metrics feed is mainnet's, so Fuji shows the levels alone. */

function HomeReadouts({ s, done, network, base, days }: { s: Stats | null; done: boolean; network: string; base: string; days: number | null }) {
  const { subnets, loading: stakeLoading } = useValidatorStats(network);
  const history = usePrimaryHistory(days !== null);
  // the staking and L1 sheets are mainnet's; Fuji's figures door into its validators
  const sheet = (path: string, fuji?: string) => (network === "mainnet" ? `${base}/${path}` : fuji && `${base}/${fuji}`);
  const ops = usePolledJson<L1Ops>(pchainL1OpsPath(network));

  // the Primary Network's stake now, from the liveness feed (nAVAX)
  const staked = useMemo(() => {
    const primary = subnets?.find((sub) => sub.id === PRIMARY_SUBNET_ID);
    return primary?.totalStakeString ? Number(primary.totalStakeString) / 1e9 : null;
  }, [subnets]);
  const supply = s?.currentSupply ? Number(s.currentSupply) / 1e9 : null;
  const move = (points: DayPoint[] | undefined) => (days === null ? NO_MOVE : levelWindow(points, days));
  const stakeMove = move(history?.staked);
  const validatorMove = move(history?.validators);
  const delegatorMove = move(history?.delegators);

  const conversions = ops.data?.conversions ?? [];
  const toDate = conversions.length ? conversions[conversions.length - 1].cumulative : null;
  const recent = ops.data ? ops.data.ops.reduce((t, d) => t + d.convert, 0) : null;
  // a stats read that failed shows the dash, not a figure still loading
  const count = (v: number | undefined) => (v !== undefined ? v.toLocaleString("en-US") : done ? "—" : null);

  return (
    <ReadoutRow cols={6} className="sm:grid-cols-3">
      <Readout
        label="Staked"
        href={sheet("staking/total-stake", "validators")}
        value={staked !== null ? fmtCompact(staked) : stakeLoading ? null : "—"}
        unit="AVAX"
        sub={staked && supply ? `${((staked / supply) * 100).toFixed(1)}% of supply` : undefined}
        delta={stakeMove.delta}
        spark={stakeMove.spark}
      />
      <Readout label="Primary Validators" href={`${base}/validators`} value={count(s?.validatorCount)} delta={validatorMove.delta} spark={validatorMove.spark} />
      <Readout label="Delegators" href={sheet("staking/total-stake", "validators")} value={count(s?.delegatorCount)} delta={delegatorMove.delta} spark={delegatorMove.spark} />
      <Readout label="L1 Validators" href={`${base}/validators/l1s`} value={count(s?.l1ValidatorCount)} />
      {/* each conversion makes an L1: the curve is the L1s to date, month by month */}
      <Readout
        label="L1 Conversions"
        href={sheet("l1s")}
        value={toDate !== null ? toDate.toLocaleString("en-US") : ops.loading ? null : "—"}
        sub={recent !== null ? `${recent.toLocaleString("en-US")} in the last 30 days` : undefined}
        spark={conversions.length >= 2 ? conversions.map((c) => c.cumulative) : undefined}
      />
      {/* the P-Chain's own counter: every AVAX minted, the rewards held for current stakers too, no burn taken off */}
      <Readout label="P-Chain Supply" value={supply !== null ? fmtCompact(supply) : done ? "—" : null} unit="AVAX" sub="before burns" />
    </ReadoutRow>
  );
}

/* mainnet: the readouts ride the page clock, so the subnav shows its range control */
function ClockedReadouts(props: { s: Stats | null; done: boolean; network: string; base: string }) {
  const clock = useExplorerTimeRange();
  return <HomeReadouts {...props} days={RANGE_DAYS[clock]} />;
}

/* ------------------------------------------------------------------ */
/* The staking money flow: the 30 days behind in rewards paid out, the
   30 days ahead in stake coming unlocked. Each doors into its sheet. */

const dayCol = (d: { date: string; avax: number }): Col => ({ key: d.date, long: dayLong(d.date), tick: dayShort(d.date), v: d.avax });
const tipAvax = (v: number) => (v >= 1 ? Math.round(v).toLocaleString("en-US") : fmtAvaxShort(v));

function StakingFlow({ staking, base, doors }: { staking: StakingSeries; base: string; doors: boolean }) {
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((t, r) => t + f(r), 0);
  const tip = (c: Col, line: string) => (
    <>
      <p className="font-mono text-[10px] text-zinc-500">{c.long}</p>
      <p className="font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{tipAvax(c.v)} AVAX</p>
      <p className="font-mono text-[10px] tabular-nums text-zinc-500">{line}</p>
    </>
  );
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 lg:grid-cols-2">
      <ColumnsBlock
        label="Rewards Paid"
        href={doors ? `${base}/staking/rewards` : undefined}
        figure={fmtAvaxShort(sum(staking.rewards, (d) => d.avax))}
        unit="AVAX"
        sub={`over the last 30 days · ${sum(staking.rewards, (d) => d.payouts).toLocaleString("en-US")} payouts`}
        cols={staking.rewards.map(dayCol)}
        fmt={fmtAvaxShort}
        height={120}
        tip={(c, i) => tip(c, `${staking.rewards[i].payouts.toLocaleString("en-US")} payouts`)}
      />
      <ColumnsBlock
        label="Stake Expiring"
        href={doors ? `${base}/staking/expiry` : undefined}
        figure={fmtAvaxShort(sum(staking.unlocks, (d) => d.avax))}
        unit="AVAX"
        sub={`over the next 30 days · ${sum(staking.unlocks, (d) => d.stakers).toLocaleString("en-US")} stake entries end`}
        cols={staking.unlocks.map(dayCol)}
        fmt={fmtAvaxShort}
        height={120}
        tip={(c, i) => tip(c, `${staking.unlocks[i].stakers.toLocaleString("en-US")} stake entries end`)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PchainHome({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const live = { refreshMs: LIVE_REFRESH_MS };
  // the figures move slowly, so they poll at half the boards' cadence
  const stats = usePchainData<Stats>(network, "stats", undefined, { refreshMs: LIVE_REFRESH_MS * 2 });
  // a board's worth and the row under its clip (LiveBoards ROWS + 1)
  const txs = usePchainData<TxSummary[]>(network, "txs", { limit: ROWS + 1 }, live);
  const blocks = usePchainData<BlocksList>(network, "blocks", { limit: ROWS + 1 }, live);
  // the staking money flow does not draw without its aggregate feed
  const activity = useRememberedJson<StakingSeries>(pchainActivityPath(network));
  const staking = activity?.rewards?.length ? activity : null;

  const s = stats.data;
  const noData = !stats.loading && (stats.error === "not found" || (s && s.tipHeight === 0));

  return (
    <ExplorerShell chain={chain} network={network}>
      {noData ? (
        <Board divide={false} className="px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">No data indexed yet for this network</p>
        </Board>
      ) : (
        <div className="flex flex-col gap-12">
          {network === "mainnet" ? (
            <ClockedReadouts s={s} done={!stats.loading} network={network} base={base} />
          ) : (
            <HomeReadouts s={s} done={!stats.loading} network={network} base={base} days={null} />
          )}

          {/* the P-Chain keeps every set: below lg, where the city has no
              Versions lens, each set's AvalancheGo versions stand here */}
          {network === "mainnet" && <L1Versions className="lg:hidden" />}

          {/* the live chain, 2:3 as on the C-Chain: the blocks board has five
              short columns, the transactions board a type and a node */}
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <LatestPchainBlocks blocks={blocks.data?.blocks ?? NO_BLOCKS} base={base} loading={blocks.loading} />
            <LatestPchainTxs txs={txs.data ?? NO_TXS} base={base} loading={txs.loading} />
          </div>

          {/* the staking sheets are mainnet's: Fuji's flow has no door */}
          {staking && <StakingFlow staking={staking} base={base} doors={network === "mainnet"} />}

          {/* red band: the sanctioned solid-red divider, closing the sheet
              with the hand-off to this network's All Networks view */}
          <Link href={`/explorer/${network}`} className="group relative flex items-center justify-between overflow-hidden bg-[#E6212F] px-5 py-5 md:px-6">
            <span aria-hidden className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100" />
            <span className="relative z-10 text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">Track the full network</span>
            <ArrowRight className="relative z-10 h-4 w-4 text-white transition-colors duration-300 group-hover:text-[#E6212F]" />
          </Link>
        </div>
      )}
    </ExplorerShell>
  );
}
