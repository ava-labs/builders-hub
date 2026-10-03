"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, CellLabel, FIG, HEAD, INK, LoadMore, MUTED, ROW, RowDoor, SectionHeader, StatCell, StatStrip, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { dayLong, dayShort, formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { txTypeLabel, type NodeResponse, type NodeStakingTx, type ValidationsResponse } from "@/lib/pchain-explorer";
import { LIST_CAP, avax, delegationFeeCut } from "./node-data";
import { subnetName } from "./names";

/* A validator's record, in the explorer's ledger grammar: the terms it
   closed and what each paid, the delegations it carries, its recent
   staking txs, and every network it validates. Long lists stop at eight
   rows behind an expander. */

const RULE = "border-b border-zinc-200 dark:border-zinc-800";
const GOOD = "text-emerald-600 dark:text-emerald-400";
const stop = (e: React.MouseEvent) => e.stopPropagation();

/* the escape hatch that keeps long lists from becoming the page */
function ExpandRow({ expanded, count, onClick }: { expanded: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-t border-zinc-200 px-5 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    >
      {expanded ? "Show less" : `Show ${formatNumber(count)} more`}
    </button>
  );
}

/* Past validation terms: the node's track record.
 *
 * Deliberately shows rewards PAID rather than a historical uptime figure. The
 * Data API keeps no per-period uptime, and inventing one would be worse than
 * omitting it: a term only pays out when the node met the uptime requirement,
 * so the payout already answers "did it do the job". An unrewarded term is
 * called out in red, since that is the one row a delegator must not miss.
 */
export function ValidationHistory({ data, base }: { data: ValidationsResponse; base: string }) {
  const [showAll, setShowAll] = useState(false);
  const { periods, totals } = data;
  const lifetimeReward = BigInt(totals.validationReward) + BigInt(totals.delegationReward);
  const rows = showAll ? periods : periods.slice(0, LIST_CAP);
  const cols = "md:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1fr)_6rem_minmax(0,1fr)_6rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Past Validation Terms"
        action={
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {formatNumber(totals.periods)} completed
            {totals.unrewarded > 0 && <span className="text-[#E6212F]"> · {formatNumber(totals.unrewarded)} unrewarded</span>}
          </span>
        }
      />
      {/* two figures the table cannot say: how long, and what it all paid */}
      <StatStrip cols={2}>
        <StatCell
          label="Validating Since"
          sub={totals.firstStart ? `${formatNumber(Math.floor((Date.now() / 1000 - totals.firstStart) / 86400))} days on record` : undefined}
        >
          <span className={FIG}>{totals.firstStart ? `${dayShort(totals.firstStart)}, ${new Date(totals.firstStart * 1000).getUTCFullYear()}` : "—"}</span>
        </StatCell>
        <StatCell label="Rewards Earned" sub="own stake plus fee take, across every term">
          <span className={cn(FIG, GOOD)}>{avax(lifetimeReward.toString())}</span>
        </StatCell>
      </StatStrip>
      <Board divide={false}>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Term</span>
          <span className="text-right">Days</span>
          <span className="text-right">Stake</span>
          <span className="text-right">Delegators</span>
          <span className="text-right">Reward Paid</span>
          <span className="text-right">Ended</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((p) => {
            const paid = BigInt(p.validationReward) + BigInt(p.delegationReward);
            return (
              <div key={p.txHash} className={cn(ROW, cols, "hover:bg-transparent dark:hover:bg-transparent")}>
                {/* a phone gives the term the whole line, so its year shows */}
                <Link href={`${base}/tx/${p.txHash}`} className={cn(INK, "truncate hover:text-[#E6212F] max-md:col-span-2")} title="the staking tx">
                  {dayShort(p.startTimestamp)} → {dayLong(p.endTimestamp).replace(/^\w+, /, "")}
                </Link>
                <span className={cn(MUTED, "md:text-right")}>
                  <CellLabel>Days</CellLabel>
                  {formatNumber(Math.round((p.endTimestamp - p.startTimestamp) / 86400))}
                </span>
                <span className={cn(INK, "text-right")}>
                  <CellLabel>Stake</CellLabel>
                  {avax(p.amountStaked)}
                </span>
                <span className={cn(MUTED, "md:text-right")}>
                  <CellLabel>Delegators</CellLabel>
                  {formatNumber(p.delegatorCount)}
                </span>
                <span className="text-right font-mono text-[12.5px] tabular-nums">
                  <CellLabel>Reward Paid</CellLabel>
                  {p.rewarded ? (
                    // the reward tx is the receipt; pre-Banff payouts have none
                    p.rewardTxHash ? (
                      <Link href={`${base}/tx/${p.rewardTxHash}`} className={cn(GOOD, "hover:underline")}>
                        +{avax(paid.toString())}
                      </Link>
                    ) : (
                      <span className={GOOD}>+{avax(paid.toString())}</span>
                    )
                  ) : (
                    <span className="text-[#E6212F]">no reward</span>
                  )}
                </span>
                <span className={cn(MUTED, "md:text-right")}>
                  <CellLabel>Ended</CellLabel>
                  {timeAgo(p.endTimestamp)}
                </span>
              </div>
            );
          })}
        </div>
        {periods.length > LIST_CAP && <ExpandRow expanded={showAll} count={periods.length - LIST_CAP} onClick={() => setShowAll((v) => !v)} />}
      </Board>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function DelegatorsTable({ n, base }: { n: NodeResponse; base: string }) {
  const [showAll, setShowAll] = useState(false);
  // the API orders by stake, largest first; "recent" sorts by start so new delegations are findable
  const [sort, setSort] = useState<"stake" | "recent">("stake");
  const sorted = useMemo(() => {
    const ds = [...n.delegators];
    if (sort === "recent") ds.sort((a, b) => b.startTimestamp - a.startTimestamp);
    return ds;
  }, [n, sort]);
  const feePct = n.validator?.delegationFeePercent ?? 0;
  const cols = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_6rem_minmax(0,1fr)]";
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        label={
          // the feed lists at most 500: say so rather than contradict the count
          n.validator && n.validator.delegatorCount > n.delegators.length
            ? `Delegators · top ${formatNumber(n.delegators.length)} of ${formatNumber(n.validator.delegatorCount)}`
            : `Delegators · ${formatNumber(n.delegators.length)}`
        }
        action={
          <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {(["stake", "recent"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={sort === k ? "font-bold text-zinc-900 underline underline-offset-4 dark:text-zinc-100" : "transition-colors hover:text-[#E6212F]"}
              >
                {k === "stake" ? "by stake" : "recent"}
              </button>
            ))}
            {/* a phone keeps the room for the label: the sum sits over the rows there */}
            <span className="max-sm:hidden">
              Σ reward <span className={cn("font-bold", GOOD)}>{avax(n.delegatorsPotentialReward)}</span>
            </span>
          </span>
        }
      />
      <Board divide={false}>
        <p className={cn("px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 sm:hidden dark:text-zinc-500", RULE)}>
          Σ reward <span className={cn("font-bold", GOOD)}>{avax(n.delegatorsPotentialReward)}</span>
        </p>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Delegation</span>
          <span className="text-right">Stake</span>
          <span className="text-right" title="the delegator's reward net of the validator's fee">
            Reward
          </span>
          <span className="text-right" title={`the validator's ${feePct}% fee`}>
            Fee
          </span>
          <span className="text-right">Started</span>
          <span className="text-right">Ends</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(showAll ? sorted : sorted.slice(0, LIST_CAP)).map((d) => {
            const feeCut = Number(delegationFeeCut(d.potentialReward, feePct));
            return (
              <RowDoor key={d.txId} href={`${base}/tx/${d.txId}`} className={cn(ROW, cols)}>
                <Link href={`${base}/tx/${d.txId}`} className={cn("truncate font-mono text-[12.5px] hover:text-[#E6212F]", idInk)} onClick={stop}>
                  {truncate(d.txId, 12)}
                </Link>
                <span className={cn(INK, "text-right font-bold")}>
                  <CellLabel>Stake</CellLabel>
                  {avax(d.stakeAmount)}
                </span>
                <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", GOOD)}>
                  <CellLabel>Reward</CellLabel>+{avax(d.potentialReward - feeCut)}
                </span>
                <span className={cn(MUTED, "text-right")}>
                  <CellLabel>Fee</CellLabel>
                  {feeCut > 0 ? avax(feeCut) : ""}
                </span>
                <span className={cn(MUTED, "md:text-right")} title={formatTime(d.startTimestamp)}>
                  <CellLabel>Started</CellLabel>
                  {timeAgo(d.startTimestamp)}
                </span>
                <span className={cn(MUTED, "text-right")}>
                  <CellLabel>Ends</CellLabel>
                  {d.endTimestamp > 0 ? dayLong(d.endTimestamp).replace(/^\w+, /, "") : ""}
                </span>
              </RowDoor>
            );
          })}
        </div>
        {n.delegators.length > LIST_CAP && <ExpandRow expanded={showAll} count={n.delegators.length - LIST_CAP} onClick={() => setShowAll((v) => !v)} />}
      </Board>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Not the validation record (that is Past Validation Terms): the raw
   recent staking-tx feed, which on a busy validator is all delegator additions */

export function ActivityTable({
  history,
  base,
  more,
}: {
  history: NodeStakingTx[];
  base: string;
  more: { done: boolean; loading: boolean; onMore: () => void };
}) {
  const [showAll, setShowAll] = useState(false);
  const cols = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_6rem]";
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader label={`Recent Staking Activity · ${formatNumber(history.length)}`} />
      <Board divide={false}>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Hash</span>
          <span>Type</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Age</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(showAll ? history : history.slice(0, LIST_CAP)).map((h) => (
            <RowDoor key={h.txHash} href={`${base}/tx/${h.txHash}`} className={cn(ROW, cols)}>
              <Link href={`${base}/tx/${h.txHash}`} className={cn("truncate font-mono text-[12.5px] hover:text-[#E6212F]", idInk)} onClick={stop}>
                {truncate(h.txHash, 12)}
              </Link>
              <span className="flex min-w-0 max-md:justify-end">
                <TxTypePill type={h.txType} label={txTypeLabel(h.txType)} />
              </span>
              <span className={cn(INK, "text-right")}>{(h.weight ?? 0) > 0 ? avax(h.weight!) : ""}</span>
              <span className={cn(MUTED, "text-right")} title={formatTime(h.blockTimestamp)}>
                {timeAgo(h.blockTimestamp)}
              </span>
            </RowDoor>
          ))}
        </div>
        {history.length > LIST_CAP && <ExpandRow expanded={showAll} count={history.length - LIST_CAP} onClick={() => setShowAll((v) => !v)} />}
      </Board>
      {showAll && !more.done && <LoadMore onClick={more.onMore} disabled={more.loading} label="Load older activity" />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* one validation is already the identity's Subnet line: this table only earns space when the node validates several networks */

export function ValidationsTable({ n }: { n: NodeResponse }) {
  const cols = "md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,12rem)]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={`Validations · ${n.validations.length}`} />
      <Board divide={false}>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Kind</span>
          <span>Network</span>
          <span className="text-right">Weight or Balance</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {n.validations.map((v, i) => (
            <div key={i} className={cn(ROW, cols, "hover:bg-transparent dark:hover:bg-transparent")}>
              <span>
                <TxTypePill type={v.kind === "l1" ? "subnet" : "stake"} label={v.kind === "l1" ? "L1 seat" : "staking"} />
              </span>
              <span className="min-w-0 truncate font-mono text-[12.5px] max-md:text-right">
                <span className={INK} title={v.subnetId}>
                  {v.subnetId === PRIMARY_SUBNET_ID ? "Primary Network" : (subnetName(v.subnetId) ?? truncate(v.subnetId, 16))}
                </span>
              </span>
              <span className={cn(INK, "text-right max-md:col-span-2")}>{v.kind === "l1" ? `${formatAvax(v.balance)} balance` : formatAvax(v.weight)}</span>
            </div>
          ))}
        </div>
      </Board>
    </section>
  );
}
