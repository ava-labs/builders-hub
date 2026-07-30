"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, BoardHeader, ChartBoard, StatDash, idInk } from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { useContractNames } from "@/lib/sourcify-client";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { AccountsActivity, AccountLeader } from "@/lib/explorer-clickhouse";
import {
  ChartSection,
  Delta,
  DualChart,
  OverlayKey,
  fmtCompact,
  metricSeries,
  weekFloor,
  num,
  pctOf,
  useChainMetrics,
  windowPair,
} from "./metric-charts";

/* The chain's Accounts tab in the gas page's grammar: a readings board on
   the shared clock (each figure against its previous window), outlined
   chart cards, and the leaderboards framed the same way. The chart half
   (active/total addresses, contracts deployed) reads the chain-stats
   indexer; the leaderboard half (most-called addresses, busiest senders)
   reads ClickHouse through /api/accounts. Chains outside the ClickHouse
   dataset keep the charts and say so under the boards. */

const METRICS = ["activeAddresses", "activeSenders", "cumulativeAddresses", "contracts", "deployers"].join(",");

// the leaderboards' ClickHouse window tops out at 90 days (same budget
// as the gas market); the year clock serves 90d and says so
const MAX_LEADERBOARD_DAYS = 90;

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function useAccountsActivity(chainId: string, rangeDays: number) {
  const [activity, setActivity] = useState<AccountsActivity | null>(null);
  const [notIndexed, setNotIndexed] = useState(false);
  const served = Math.min(rangeDays, MAX_LEADERBOARD_DAYS);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setNotIndexed(false);
    fetch(`/api/accounts/${chainId}?range=${served}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotIndexed(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: AccountsActivity | null) => {
        if (!cancelled && data) setActivity(data);
      })
      .catch(() => {
        if (!cancelled) setNotIndexed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, served]);

  return { activity, notIndexed, served };
}

/* one leaderboard: rank, labelled address, and the three numbers that
   describe its traffic from this side of the transaction. The card only
   carries a window chip when it CAN'T follow the page clock. */
function LeaderBoard({
  label,
  windowNote,
  leaders,
  loading,
  base,
  names,
  counterpartyLabel,
  volumeLabel,
  volume,
}: {
  label: string;
  /** the clamp exception, e.g. "90 days · longest computed" */
  windowNote?: string;
  leaders: AccountLeader[];
  loading: boolean;
  base: string;
  names: Map<string, string>;
  counterpartyLabel: string;
  volumeLabel: string;
  volume: (l: AccountLeader) => string;
}) {
  return (
    <ChartBoard
      label={label}
      bodyClassName={cn("p-0", loading && leaders.length > 0 && "opacity-60 transition-opacity")}
      action={
        windowNote ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {windowNote}
          </span>
        ) : undefined
      }
    >
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_6rem] gap-3 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:text-zinc-500">
          <span>#</span>
          <span>Address</span>
          <span className="text-right">Txs</span>
          <span className="text-right">{counterpartyLabel}</span>
          <span className="text-right">{volumeLabel}</span>
        </div>
        {leaders.map((l, i) => {
          const name = names.get(l.address.toLowerCase());
          return (
            <Link
              key={l.address}
              href={`${base}/address/${l.address}`}
              className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_6rem] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
            >
              <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                {i + 1}
              </span>
              <span
                className={`truncate font-mono text-[12px] ${idInk}`}
                title={name ? `${name} · ${l.address}` : l.address}
              >
                {name ?? shortAddr(l.address)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {fmtCompact(l.txs)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {fmtCompact(l.counterparties)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {volume(l)}
              </span>
            </Link>
          );
        })}
        {loading && leaders.length === 0 && (
          <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>
        )}
      </div>
    </ChartBoard>
  );
}

export function EvmAccounts({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;

  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const rangeLabel = rangeWindowLabel(clock);

  // fetch double the window so every reading can face its previous window
  const { metrics, failed } = useChainMetrics(c.chainId, Math.min(range * 2, 365), METRICS);
  const { activity, notIndexed, served } = useAccountsActivity(c.chainId, range);
  // the leaderboards' one exception to the page clock, stated on the card
  const boardsNote = served < range ? `${served} days · longest computed` : undefined;

  const m = metrics ?? {};
  const current = (key: string) => num(m[key]?.current_value);
  const win = (key: string, mode: "sum" | "avg" = "sum") => windowPair(m[key]?.data, range, mode);

  // one Sourcify pass over both boards — the resolved names accumulate,
  // so flipping the clock relabels instantly for repeat leaders
  const leaderAddresses = useMemo(
    () => [...(activity?.called ?? []), ...(activity?.senders ?? [])].map((l) => l.address),
    [activity],
  );
  const names = useContractNames(c.chainId, leaderAddresses);

  // the readings row on the page clock — cells only carry a window label
  // when they DON'T follow it (the all-time total)
  const activePair = win("activeAddresses", "avg");
  const sendersPair = win("activeSenders", "avg");
  const contractsPair = win("contracts");
  const deployersPair = win("deployers");
  const totalAddresses = current("cumulativeAddresses");

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-10">
        {/* the window is stated once, up here */}
        <Board divide={false} className="border">
          <BoardHeader
            label="Accounts"
            display
            action={
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                {rangeLabel}
              </span>
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-sm:[&>*:nth-child(odd)]:border-l-0 sm:grid-cols-3 sm:divide-y-0 dark:divide-zinc-800">
            <Stat
              label="Active Addresses"
              sub={
                activePair ? (
                  <>
                    {sendersPair
                      ? `${range > 1 ? "avg " : ""}${fmtCompact(sendersPair.cur)} senders · `
                      : range > 1
                        ? "daily avg · "
                        : null}
                    <Delta value={pctOf(activePair)} />
                  </>
                ) : undefined
              }
            >
              {activePair ? fmtCompact(activePair.cur) : metrics || failed ? <StatDash /> : "…"}
            </Stat>
            <Stat label="Total Addresses" sub="all-time">
              {totalAddresses !== null ? fmtCompact(totalAddresses) : metrics || failed ? <StatDash /> : "…"}
            </Stat>
            <Stat
              label="Contracts Deployed"
              sub={
                contractsPair ? (
                  <>
                    {deployersPair ? `${fmtCompact(deployersPair.cur)} deployers · ` : null}
                    <Delta value={pctOf(contractsPair)} />
                  </>
                ) : undefined
              }
            >
              {contractsPair ? fmtCompact(contractsPair.cur) : metrics || failed ? <StatDash /> : "…"}
            </Stat>
          </div>
        </Board>

        {/* the population over time */}
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartSection
            label={`Active Addresses${weekFloor(range)}`}
            action={<OverlayKey label="senders" />}
          >
            {metricSeries(m, range, "activeAddresses", "activeSenders").length ? (
              <DualChart
                data={metricSeries(m, range, "activeAddresses", "activeSenders")}
                kind="area"
                fmt={fmtCompact}
                aLabel="addresses"
                bLabel="senders"
              />
            ) : (
              <ChartEmpty failed={!!metrics || failed} />
            )}
          </ChartSection>

          <ChartSection label={`Total Addresses${weekFloor(range)}`}>
            {metricSeries(m, range, "cumulativeAddresses").length ? (
              <DualChart
                data={metricSeries(m, range, "cumulativeAddresses")}
                kind="area"
                fmt={fmtCompact}
                aLabel="addresses all-time"
              />
            ) : (
              <ChartEmpty failed={!!metrics || failed} />
            )}
          </ChartSection>
        </div>

        <ChartSection
          label={`Contracts Deployed${weekFloor(range)}`}
          action={<OverlayKey label="deployers" dashed />}
        >
          {metricSeries(m, range, "contracts", "deployers").length ? (
            <DualChart
              data={metricSeries(m, range, "contracts", "deployers")}
              kind="bars"
              fmt={fmtCompact}
              aLabel="contracts"
              bLabel="deployers"
              bOwnAxis
            />
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartSection>

        {/* who the traffic actually is */}
        {notIndexed ? (
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Leaderboards need indexed transaction history; this chain isn&apos;t in the dataset yet.
          </p>
        ) : (
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            <LeaderBoard
              label="Most Called"
              windowNote={boardsNote}
              leaders={activity?.called ?? []}
              loading={!activity}
              base={base}
              names={names}
              counterpartyLabel="Senders"
              volumeLabel="Fees"
              volume={(l) => `${fmtCompact(l.feesNative)} ${sym}`}
            />
            <LeaderBoard
              label="Top Senders"
              windowNote={boardsNote}
              leaders={activity?.senders ?? []}
              loading={!activity}
              base={base}
              names={names}
              counterpartyLabel="Dests"
              volumeLabel="Moved"
              volume={(l) => `${fmtCompact(l.native)} ${sym}`}
            />
          </div>
        )}
      </div>
    </EvmShell>
  );
}
