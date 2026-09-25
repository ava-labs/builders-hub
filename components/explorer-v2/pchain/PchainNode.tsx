"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, BoardHeader, CellLabel, DetailSkeleton, HashChip, SectionHeader, SpecLine, SpecPlate, SpecRow, SpecSheet, SubjectHeadline, TxTypePill, idInk, ROW, LoadMore } from "@/components/explorer-v2/ui";
import { ShareMap } from "@/components/explorer-v2/ShareMap";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { RailRow } from "@/components/explorer-v2/evm/EvmTx";
import { dayLong, dayShort, formatAvax, formatNumber, formatTime, hourLong, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import {
  PRIMARY_SUBNET_ID,
  getCurrentValidators,
  getPrimaryTotalStake,
  type CurrentValidator,
} from "@/lib/pchain-node";
import { txTypeLabel, type NodeResponse, type NodeStakingTx, type TxSummary, type ValidationsResponse } from "@/lib/pchain-explorer";
import { cn } from "@/lib/utils";

/* The node page, split like the tx and block pages. Left: the stake map
   (own stake, delegated, open room against the cap) and the current term
   as a line through time, with what it pays said as a sentence. Right: the
   readings a delegator judges a validator by, in a rail. Then the last 14
   days of uptime and blocks, the track record, the identifiers whole, and
   the long lists capped behind expanders. */

/* --- the P2P observatory feed (hourly uptime, block production, slots) --- */

interface P2PDetail {
  current_p50_uptime: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime: { bucket: string; p50_uptime: number }[];
  blocks: { hour: string; proposed: number; missed: number }[];
  slots: { slot: number; cnt: number }[];
}

function useP2PDetail(nodeId: string, enabled: boolean) {
  const [data, setData] = useState<P2PDetail | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/validators/${encodeURIComponent(nodeId)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => controller.abort();
  }, [nodeId, enabled]);
  return data;
}

/* --- the track record: past validation terms and what they paid --- */

/* The node document's `history` cannot answer this. Upstream caps it at 100
   recent staking txs and honours no filter, so on a validator with thousands
   of delegators every row is a delegator addition and the node's own past
   terms fall off the end. The Data API indexes the terms themselves. */
function useValidationHistory(network: string, nodeId: string): ValidationsResponse | null {
  const [data, setData] = useState<ValidationsResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pchain-validations/${network}/${encodeURIComponent(nodeId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ValidationsResponse | null) => d?.periods && setData(d))
      .catch(() => {
        /* a node with no closed terms just doesn't get the section */
      });
    return () => controller.abort();
  }, [network, nodeId]);
  return data;
}

/* the money context the indexer doesn't mirror: the live validator entry
   (payout owners, BLS identity) and the network's total stake: the
   denominator that turns this validator's stake into a share */
function useStakeContext(network: string, nodeId: string, enabled: boolean) {
  const [identity, setIdentity] = useState<CurrentValidator | null>(null);
  const [networkStake, setNetworkStake] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [nodeId]).then((vs) => {
      if (!cancelled) setIdentity(vs?.[0] ?? null);
    });
    getPrimaryTotalStake(network).then((s) => {
      if (!cancelled) setNetworkStake(s);
    });
    return () => {
      cancelled = true;
    };
  }, [network, nodeId, enabled]);
  return { identity, networkStake };
}

/* Primary Network staking rules: a validator can carry delegations up to
   5x its own stake, capped at 3M AVAX total. What's left of that headroom
   is the number a would-be delegator actually cares about. */
const MAX_TOTAL_STAKE_NAVAX = 3_000_000 * 1e9;

const LIST_CAP = 8;

const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" } as const;

/** nAVAX as a human reads it: millions compact, two decimals below that,
 *  four under one AVAX */
function avax(nAvax: number | string | bigint): string {
  const v = Number(nAvax) / 1e9;
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}M AVAX`;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) >= 1 ? 2 : 4 })} AVAX`;
}

const SHARES_DENOM = 1_000_000n;

function delegationFeeCut(gross: number, feePercent: number): bigint {
  const g = BigInt(Math.max(0, Math.round(gross)));
  const shares = BigInt(Math.round(feePercent * 10_000));
  if (g === 0n || shares <= 0n) return 0n;
  if (shares >= SHARES_DENOM) return g;
  const delegatorNet = ((SHARES_DENOM - shares) * g) / SHARES_DENOM; // floors
  return g - delegatorNet;
}

export function PchainNode({
  chain,
  network,
  nodeId,
  subnetHint,
}: {
  chain: string;
  network: string;
  nodeId: string;
  /** subnet the caller knows this node validates: lets us ask the P-Chain
   *  directly when the indexer (Primary Network only) has never seen it */
  subnetHint?: string;
}) {
  const base = `/explorer/${network}/${chain}`;
  const { data: n, loading, error } = usePchainData<NodeResponse>(network, `node/${nodeId}`);
  // the P2P observatory only watches mainnet's Primary Network
  const p2p = useP2PDetail(nodeId, network === "mainnet" && Boolean(n?.hasSnapshot));
  // payout owners + BLS identity + the network-share denominator, live
  const { identity, networkStake } = useStakeContext(network, nodeId, Boolean(n?.hasSnapshot));
  // past terms: asked for unconditionally, since the nodes where the track
  // record matters most are the ones no longer in the current snapshot
  const validations = useValidationHistory(network, nodeId);

  // the stake story, derived once: share of the network, delegation
  // headroom, the validator's total take, how far through the term it is
  const stake = useMemo(() => {
    const v = n?.validator;
    if (!v) return null;
    const maxTotal = Math.min(5 * v.weight, MAX_TOTAL_STAKE_NAVAX);
    const capacity = Math.max(0, maxTotal - v.totalStake);
    const sharePct = networkStake ? (v.totalStake / networkStake) * 100 : null;
    // Split each delegation the way the chain does, then sum: not the other
    // way round. avalanchego's reward.Split floors the DELEGATOR's side and
    // gives the validator the remainder, per delegation:
    //   net = floor((1e6 − shares) × gross / 1e6);  fee = gross − net
    // A percentage multiply on the aggregate rounds the other way and lands a
    // nAVAX off on each tile (2026-08-20: 23,065.1 vs the chain's 23,066).
    const feeTake = Number(
      n.delegators.reduce((sum, d) => sum + delegationFeeCut(d.potentialReward, v.delegationFeePercent), 0n),
    );
    const totalTake = v.potentialReward + feeTake;
    const now = Date.now() / 1000;
    const span = v.endTimestamp - v.startTimestamp;
    const progressPct =
      span > 0 ? Math.min(100, Math.max(0, ((now - v.startTimestamp) / span) * 100)) : null;
    return { maxTotal, capacity, sharePct, feeTake, totalTake, progressPct };
  }, [n, networkStake]);
  // pre-Banff validators carry one rewardOwner; later ones split the pair
  const validationPayout = identity?.validationRewardOwner ?? identity?.rewardOwner;
  const delegationPayout = identity?.delegationRewardOwner ?? identity?.rewardOwner;

  // L1-only validators never stake on the Primary Network. The subnet can
  // arrive two ways: a ?subnet= hint on the link, or: since the indexer
  // learned to return L1-only nodes: the node document's own validations.
  // Either way we go straight to the node for the rich seat view:
  // platform.getCurrentValidators({subnetID, nodeIDs}).
  const l1Subnet = subnetHint ?? n?.validations?.find((v) => v.kind === "l1")?.subnetId;
  // no snapshot, no staking history: the L1 seat IS this node's story
  const l1Only = !!n && !n.hasSnapshot && (n.history?.length ?? 0) === 0;
  // the document's own l1 validation, shaped like the RPC record: the
  // render fallback when the RPC can't answer (rate limit, outage). The
  // page must never go blank while holding the seat data in hand.
  const l1FromDoc = useMemo<CurrentValidator | null>(() => {
    const v = n?.validations?.find((x) => x.kind === "l1");
    if (!v) return null;
    return {
      nodeID: nodeId,
      weight: String(v.weight),
      balance: v.balance !== undefined ? String(v.balance) : undefined,
      validationID: v.validationId,
    };
  }, [n, nodeId]);
  const [l1, setL1] = useState<CurrentValidator | null>(null);
  const [l1Checked, setL1Checked] = useState(false);
  useEffect(() => {
    if (!(error || l1Only) || !l1Subnet) return;
    let cancelled = false;
    getCurrentValidators(network, l1Subnet, [nodeId]).then((vs) => {
      if (cancelled) return;
      setL1(vs?.[0] ?? null);
      setL1Checked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [error, l1Only, l1Subnet, network, nodeId]);

  const [showAllDelegators, setShowAllDelegators] = useState(false);
  // the API orders by stake DESC; "recent" re-sorts by
  // delegation start so new delegations are findable again
  const [delegatorSort, setDelegatorSort] = useState<"stake" | "recent">("stake");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const [olderHistory, setOlderHistory] = useState<NodeStakingTx[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | undefined>(undefined);
  const [historyDone, setHistoryDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlderHistory = async () => {
    if (historyDone || loadingOlder || !n) return;
    setLoadingOlder(true);
    try {
      const seen = new Set([...n.history.map((h) => h.txHash), ...olderHistory.map((h) => h.txHash)]);
      let cursor = historyCursor;
      for (let hop = 0; hop < 4; hop++) {
        const qs = new URLSearchParams({ node: nodeId, limit: "100" });
        if (cursor !== undefined) qs.set("before", String(cursor));
        const res = await fetch(`/api/pchain/${network}/txs?${qs}`);
        const page: TxSummary[] = res.ok ? await res.json() : [];
        if (page.length === 0) {
          setHistoryDone(true);
          break;
        }
        cursor = page[page.length - 1].blockHeight;
        const fresh = page.filter((t) => !seen.has(t.txHash));
        if (fresh.length > 0) {
          setOlderHistory((o) => [
            ...o,
            ...fresh.map((t) => ({
              txHash: t.txHash,
              txType: t.txType,
              blockTimestamp: t.blockTimestamp,
              period: t.period,
            })),
          ]);
          break;
        }
      }
      setHistoryCursor(cursor);
    } finally {
      setLoadingOlder(false);
    }
  };
  const fullHistory = n ? [...n.history, ...olderHistory] : [];

  const sortedDelegators = useMemo(() => {
    const ds = [...(n?.delegators ?? [])];
    if (delegatorSort === "recent") ds.sort((a, b) => b.startTimestamp - a.startTimestamp);
    return ds; // API default is stake DESC
  }, [n, delegatorSort]);

  const uptimeSeries = useMemo(
    () =>
      p2p?.uptime?.length
        ? p2p.uptime.map((u) => ({ t: u.bucket, v: u.p50_uptime }))
        : (n?.uptimeHistory ?? []).map((h, i) => ({ t: String(i), v: h.p50Uptime })),
    [p2p, n],
  );
  const blocksSeries = useMemo(
    () => (p2p?.blocks ?? []).map((b) => ({ t: b.hour, proposed: b.proposed, missed: b.missed })),
    [p2p],
  );
  const slots = useMemo(() => {
    if (!p2p?.slots?.length) return null;
    const total = p2p.slots.reduce((s, x) => s + x.cnt, 0);
    if (total === 0) return null;
    const at = (s: number) => p2p.slots.find((x) => x.slot === s)?.cnt ?? 0;
    const slot2plus = total - at(0) - at(1);
    return { total, slot0: at(0), slot1: at(1), slot2plus };
  }, [p2p]);

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Validator" />}
      {(error || l1Only) && l1Subnet && !l1Checked && <DetailSkeleton label="Validator" />}
      {error && (!l1Subnet || (l1Checked && !l1)) && <NotFound label="Node not found" id={nodeId} />}
      {/* the seat view: the RPC record when the node answered, the doc's
          own copy when it couldn't: a rate-limited RPC must not blank a
          page whose data is already in hand */}
      {(error || l1Only) && l1Checked && l1Subnet && (l1 ?? l1FromDoc) && (
        <L1ValidatorView
          nodeId={nodeId}
          subnetId={l1Subnet}
          v={(l1 ?? l1FromDoc)!}
          live={!!l1}
          base={base}
        />
      )}
      {/* nodes with staking history (or no l1 seat at all) keep the full
          indexer document view: including the corner where a subnet hint
          exists but neither the RPC nor the doc could produce a seat */}
      {n && (!l1Only || !l1Subnet || (l1Checked && !l1 && !l1FromDoc)) && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader
              label="Validator"
              action={
                // connection state comes from the Primary Network snapshot:
                // without one it's a zero value, not a real "Offline"
                n.hasSnapshot ? (
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                      n.validator.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${n.validator.connected ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                    {n.validator.connected ? "Connected" : "Offline"}
                  </span>
                ) : undefined
              }
            />
            <div className="flex flex-col gap-2">
              <SubjectHeadline value={n.nodeId} copyLabel="Copy NodeID" />
              {/* who it is, in one line a human can read */}
              <p className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {[
                  n.nodeInfo?.version,
                  n.nodeInfo?.publicIp,
                  validations?.totals.firstStart ? `validating since ${dayLong(validations.totals.firstStart)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {!n.hasSnapshot && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Not in the latest validator snapshot. Showing on-chain history.
              </p>
            )}
          </section>

          {/* the split: the stake and the term on the left, the readings a
              delegator judges a validator by in the rail on the right */}
          {n.hasSnapshot && stake && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="flex min-w-0 flex-col gap-6">
                {/* the stake map: what fills this validator's weight, against
                    the most it may carry */}
                <ShareMap
                  label="Stake map"
                  summary={`${avax(n.validator.totalStake)} of ${avax(stake.maxTotal)} max`}
                  fmt={(v) => avax(v)}
                  legend={3}
                  parts={[
                    { key: "own", label: "Own stake", value: n.validator.weight, tone: "#18181b", sub: "locked by the operator" },
                    {
                      key: "delegated",
                      label: "Delegated",
                      value: n.validator.delegatorWeight,
                      tone: "#0061E2",
                      sub: `${formatNumber(n.validator.delegatorCount)} delegators`,
                    },
                    {
                      key: "open",
                      label: "Open capacity",
                      value: stake.capacity,
                      tone: "#e4e4e7",
                      sub: stake.capacity === 0 ? "full: no room to delegate" : "room left to delegate",
                    },
                  ].filter((p) => p.value > 0 || p.key === "open")}
                  note={
                    stake.capacity === 0
                      ? `This validator is full. Its stake is capped at five times its own stake, and at 3M AVAX, so new delegations cannot join until one ends.`
                      : `${avax(stake.capacity)} of room is left before the cap: five times the own stake, and at most 3M AVAX.`
                  }
                />

                {/* the term, as a line through time */}
                <Board divide={false}>
                  <div className="flex items-baseline justify-between gap-4 px-5 pt-5 md:px-6">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Current term</span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formatNumber(Math.round((n.validator.endTimestamp - n.validator.startTimestamp) / 86400))} days
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 px-5 pb-5 pt-4 md:px-6">
                    <div className="relative h-8">
                      <div className="absolute inset-x-0 top-3 h-2 bg-zinc-100 dark:bg-zinc-900" />
                      <div className="absolute left-0 top-3 h-2 bg-zinc-900 dark:bg-zinc-100" style={{ width: `${(stake.progressPct ?? 0).toFixed(2)}%` }} />
                      {/* today */}
                      <div className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center" style={{ left: `${(stake.progressPct ?? 0).toFixed(2)}%` }}>
                        <span className="h-8 w-px bg-zinc-900 dark:bg-zinc-100" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-baseline gap-3 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Started</span>
                        {dayLong(n.validator.startTimestamp)}
                      </span>
                      <span className="text-center text-zinc-900 dark:text-zinc-50">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Today</span>
                        {stake.progressPct?.toFixed(0)}% done · {formatNumber(n.validator.daysLeft)} days left
                      </span>
                      <span className="text-right text-zinc-500 dark:text-zinc-400">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Ends</span>
                        {dayLong(n.validator.endTimestamp)}
                      </span>
                    </div>
                    {/* what the term pays, said as a sentence */}
                    <p className="border-t border-zinc-200 pt-4 font-mono text-[13px] leading-[1.8] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                      If uptime holds until {dayLong(n.validator.endTimestamp)}, this term pays the validator{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">{avax(stake.totalTake)}</span>{" "}
                      <span className="text-zinc-400 dark:text-zinc-500">
                        ({avax(n.validator.potentialReward)} on its own stake, {avax(stake.feeTake)} in its {n.validator.delegationFeePercent}% fee)
                      </span>{" "}
                      and its delegators <span className="text-emerald-600 dark:text-emerald-400">{avax(Math.max(0, n.delegatorsPotentialReward - stake.feeTake))}</span>.
                    </p>
                  </div>
                </Board>
              </div>

              {/* the readings: the rail stands as tall as the column beside it */}
              <Board divide={false} className="flex flex-col border">
                <RailRow label="Status" sub={n.validator.connected ? "reachable by its peers" : "not reachable right now"}>
                  {n.validator.connected ? <span className="text-emerald-600 dark:text-emerald-400">Connected</span> : <span className="text-zinc-400">Offline</span>}
                </RailRow>
                <RailRow label="Uptime" sub={p2p?.uptime?.length ? "peers' median view, last 14 days" : "peers' median view"}>
                  <span className={n.uptime.currentP50 >= 90 ? undefined : "text-[#E6212F]"}>{n.uptime.currentP50.toFixed(2)}%</span>
                </RailRow>
                <RailRow label="Total Stake" sub={stake.sharePct != null ? `${stake.sharePct.toFixed(2)}% of the network` : undefined}>
                  {avax(n.validator.totalStake)}
                </RailRow>
                <RailRow label="Delegation Fee" sub="its cut of delegators' rewards">
                  {n.validator.delegationFeePercent}%
                </RailRow>
                {p2p && (
                  <RailRow
                    label="Blocks · 14 days"
                    sub={
                      <span className={p2p.missed_14d > 0 ? "text-[#E6212F]" : undefined}>
                        {formatNumber(p2p.missed_14d)} missed · {p2p.miss_rate_14d.toFixed(1)}%
                      </span>
                    }
                  >
                    {formatNumber(p2p.proposed_14d)} proposed
                  </RailRow>
                )}
                <RailRow label="Term Ends" sub={`${formatNumber(n.validator.daysLeft)} days left`}>
                  {dayShort(n.validator.endTimestamp)}
                </RailRow>
              </Board>
            </div>
          )}

          {/* how it has performed: uptime by the hour, blocks by the day */}
          {n.hasSnapshot && (uptimeSeries.length > 1 || blocksSeries.length > 1) && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Performance · last 14 days" />
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                {uptimeSeries.length > 1 && (
                  <Board divide={false} className="flex flex-col gap-3 px-5 py-5 md:px-6">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Uptime</span>
                    <p className="font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {n.uptime.max - n.uptime.min < 0.1 ? (
                        <>
                          Steady at <span className="text-zinc-900 dark:text-zinc-50">{n.uptime.avg.toFixed(2)}%</span>: the lowest hour was{" "}
                          {n.uptime.min.toFixed(2)}%. Rewards need 90%.
                        </>
                      ) : (
                        <>
                          Between <span className="text-zinc-900 dark:text-zinc-50">{n.uptime.min.toFixed(1)}%</span> and{" "}
                          <span className="text-zinc-900 dark:text-zinc-50">{n.uptime.max.toFixed(1)}%</span>, {n.uptime.avg.toFixed(1)}% on average. Rewards need 90%.
                        </>
                      )}
                    </p>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={uptimeSeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.18)" />
                          <XAxis dataKey="t" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={56} interval="preserveStartEnd" tickFormatter={(t: string) => (/^\d{4}-/.test(t) ? dayShort(t) : "")} />
                          <YAxis orientation="right" width={48} tickLine={false} axisLine={false} tick={AXIS_TICK} tickCount={3} domain={[(min: number) => Math.max(0, Math.floor(min * 10) / 10 - 0.1), 100]} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                          <RechartsTooltip
                            cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload as { t: string; v: number };
                              return (
                                <TipPlate>
                                  <p className="text-[10px] text-zinc-500">{/^\d{4}-/.test(d.t) ? hourLong(d.t.slice(0, 16)) : "snapshot"}</p>
                                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{d.v.toFixed(2)}% uptime</p>
                                </TipPlate>
                              );
                            }}
                          />
                          <Area dataKey="v" type="monotone" stroke="#059669" strokeWidth={1.5} fill="#059669" fillOpacity={0.08} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Board>
                )}
                {blocksSeries.length > 1 && p2p && (
                  <Board divide={false} className="flex flex-col gap-3 px-5 py-5 md:px-6">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Blocks proposed</span>
                    <p className="font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Proposed <span className="text-zinc-900 dark:text-zinc-50">{formatNumber(p2p.proposed_14d)}</span> blocks and missed{" "}
                      <span className={p2p.missed_14d > 0 ? "text-[#E6212F]" : "text-zinc-900 dark:text-zinc-50"}>{formatNumber(p2p.missed_14d)}</span>
                      {slots ? `; ${((slots.slot0 / slots.total) * 100).toFixed(1)}% landed on the first try` : ""}.
                    </p>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={blocksSeries} barCategoryGap="22%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.18)" />
                          <XAxis dataKey="t" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={40} interval="preserveStartEnd" tickFormatter={(t: string) => dayShort(t.slice(0, 10))} />
                          <YAxis orientation="right" width={40} tickLine={false} axisLine={false} tick={AXIS_TICK} tickCount={3} domain={[0, "dataMax"]} tickFormatter={(v: number) => formatNumber(v)} />
                          <RechartsTooltip
                            cursor={{ fill: "rgba(161,161,170,0.08)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload as { t: string; proposed: number; missed: number };
                              return (
                                <TipPlate>
                                  <p className="text-[10px] text-zinc-500">{dayLong(d.t.slice(0, 10))}</p>
                                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(d.proposed)} proposed</p>
                                  <p className={cn("text-[10px] tabular-nums", d.missed > 0 ? "text-[#E6212F]" : "text-zinc-500")}>{formatNumber(d.missed)} missed</p>
                                </TipPlate>
                              );
                            }}
                          />
                          <Bar dataKey="proposed" stackId="b" fill="#A2AFB2" isAnimationActive={false} />
                          <Bar dataKey="missed" stackId="b" fill="#E6212F" isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Board>
                )}
              </div>
            </section>
          )}

          {/* the track record: every closed term and what it actually paid */}
          {validations && validations.periods.length > 0 && <ValidationHistory data={validations} base={base} />}

          {/* the identifiers, whole */}
          {n.hasSnapshot && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Identity" />
              <Board divide={false} className="px-5 md:px-6">
                <SpecSheet>
                  <SpecLine label="Subnet">
                    {n.validator.subnetId === PRIMARY_SUBNET_ID ? (
                      <span className="inline-flex flex-wrap items-baseline gap-x-3">
                        Primary Network
                        <HashChip value={n.validator.subnetId} len={66} className="text-zinc-400 dark:text-zinc-500" />
                      </span>
                    ) : (
                      <HashChip value={n.validator.subnetId} len={66} />
                    )}
                  </SpecLine>
                  {n.validator.validationId && (
                    <SpecLine label="Validation ID">
                      <HashChip value={n.validator.validationId} len={66} />
                    </SpecLine>
                  )}
                  {n.validator.txId && (
                    <SpecLine label="Staking Tx">
                      <HashChip value={n.validator.txId} href={`${base}/tx/${n.validator.txId}`} len={66} />
                    </SpecLine>
                  )}
                  {/* where the money lands, live from the P-Chain, since the
                      indexer doesn't mirror reward owners */}
                  {validationPayout?.addresses?.[0] && (
                    <SpecLine label={delegationPayout?.addresses?.[0] && delegationPayout.addresses[0] !== validationPayout.addresses[0] ? "Payout · Validation" : "Payout"}>
                      <HashChip value={validationPayout.addresses[0]} href={`${base}/address/${validationPayout.addresses[0]}`} len={66} />
                    </SpecLine>
                  )}
                  {delegationPayout?.addresses?.[0] && delegationPayout.addresses[0] !== validationPayout?.addresses?.[0] && (
                    <SpecLine label="Payout · Delegation">
                      <HashChip value={delegationPayout.addresses[0]} href={`${base}/address/${delegationPayout.addresses[0]}`} len={66} />
                    </SpecLine>
                  )}
                  {identity?.signer?.publicKey && (
                    <SpecLine label="BLS Public Key" align="start">
                      <HashChip value={identity.signer.publicKey} len={200} />
                    </SpecLine>
                  )}
                </SpecSheet>
              </Board>
            </section>
          )}

          {/* one validation is already the plate's Subnet row: this strip
              only earns space when the node validates several networks */}
          {n.validations.length > 1 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Validations · ${n.validations.length}`} />
              <Board divide={false}>
                <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3 dark:divide-zinc-800">
                  {n.validations.map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                          {v.kind}
                        </span>
                        <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                          {truncate(v.subnetId, 16)}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {v.kind === "l1" ? formatAvax(v.balance) : formatAvax(v.weight)}
                      </span>
                    </div>
                  ))}
                </div>
              </Board>
            </section>
          )}

          {/* split view: money | record: two symmetric lists, same cap,
              same rhythm, so the rails end together */}
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            {n.delegators.length > 0 && (
              <section className="flex min-w-0 flex-col gap-4">
                <SectionHeader
                  label={
                    // the feed lists at most 500; say so rather than contradict the count
                    n.validator && n.validator.delegatorCount > n.delegators.length
                      ? `Delegators · top ${formatNumber(n.delegators.length)} of ${formatNumber(n.validator.delegatorCount)}`
                      : `Delegators · ${formatNumber(n.delegators.length)}`
                  }
                  action={
                    <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      {(["stake", "recent"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => setDelegatorSort(k)}
                          className={
                            delegatorSort === k
                              ? "font-bold text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
                              : "transition-colors hover:text-[#E6212F]"
                          }
                        >
                          {k === "stake" ? "by stake" : "recent"}
                        </button>
                      ))}
                      <span>
                        Σ reward{" "}
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {avax(n.delegatorsPotentialReward)}
                        </span>
                      </span>
                    </div>
                  }
                />
                <Board>
                  {(showAllDelegators ? sortedDelegators : sortedDelegators.slice(0, LIST_CAP)).map((d) => {
                    const feePct = n.validator?.delegationFeePercent ?? 0;
                    const feeCut = Number(delegationFeeCut(d.potentialReward, feePct));
                    const net = d.potentialReward - feeCut;
                    return (
                      <Link
                        key={d.txId}
                        href={`${base}/tx/${d.txId}`}
                        className="flex flex-col gap-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className={`font-mono text-[12px] ${idInk}`}>{truncate(d.txId, 20)}</span>
                          <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {avax(d.stakeAmount)}
                            </span>
                            <span
                              className="text-emerald-600 dark:text-emerald-400"
                              title="delegator's reward net of the validator's fee"
                            >
                              +{avax(net)}
                            </span>
                            {feeCut > 0 && (
                              <span title={`validator's ${feePct}% fee cut`}>
                                fee {avax(feeCut)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-between gap-x-4 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                          <span title={formatTime(d.startTimestamp)}>started {timeAgo(d.startTimestamp)}</span>
                          {d.endTimestamp > 0 && <span>ends {dayLong(d.endTimestamp)}</span>}
                        </div>
                      </Link>
                    );
                  })}
                  {n.delegators.length > LIST_CAP && (
                    <ExpandRow
                      expanded={showAllDelegators}
                      count={n.delegators.length - LIST_CAP}
                      onClick={() => setShowAllDelegators((v) => !v)}
                    />
                  )}
                </Board>
              </section>
            )}

            {n.history.length > 0 && (
              <section className="flex min-w-0 flex-col gap-4">
                {/* not the validation record (that's Past Validation Terms
                    above): this is the raw recent staking-tx feed, which on a
                    busy validator is all delegator additions */}
                <SectionHeader label={`Recent staking activity · ${fullHistory.length}`} />
                <Board>
                  {(showAllHistory ? fullHistory : fullHistory.slice(0, LIST_CAP)).map((h) => (
                    <Link
                      key={h.txHash}
                      href={`${base}/tx/${h.txHash}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`truncate font-mono text-[12px] ${idInk}`}>
                          {truncate(h.txHash, 20)}
                        </span>
                        <TxTypePill type={h.txType} label={txTypeLabel(h.txType)} />
                      </div>
                      <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        {(h.weight ?? 0) > 0 && (
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {avax(h.weight!)}
                          </span>
                        )}
                        <span title={formatTime(h.blockTimestamp)}>{timeAgo(h.blockTimestamp)}</span>
                      </div>
                    </Link>
                  ))}
                  {fullHistory.length > LIST_CAP && (
                    <ExpandRow
                      expanded={showAllHistory}
                      count={fullHistory.length - LIST_CAP}
                      onClick={() => setShowAllHistory((v) => !v)}
                    />
                  )}
                </Board>
                {showAllHistory && !historyDone && (
                  <LoadMore onClick={loadOlderHistory} disabled={loadingOlder} label="Load older activity" />
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </ExplorerShell>
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
function ValidationHistory({ data, base }: { data: ValidationsResponse; base: string }) {
  const [showAll, setShowAll] = useState(false);
  const { periods, totals } = data;
  const lifetimeReward = BigInt(totals.validationReward) + BigInt(totals.delegationReward);
  // delegations, not people: the same delegator re-staking across two terms
  // counts twice, which is the honest reading of "how much work has this node
  // taken on" rather than a unique-holder count the API can't give us
  const delegationsServed = periods.reduce((s, p) => s + p.delegatorCount, 0);
  const rows = showAll ? periods : periods.slice(0, LIST_CAP);

  return (
    <section className="flex flex-col gap-3">
      <Board divide={false} className="border">
        <BoardHeader
          label="Past Validation Terms"
          display
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {formatNumber(totals.periods)} completed
              {totals.unrewarded > 0 && (
                <span className="text-[#E6212F]"> · {formatNumber(totals.unrewarded)} unrewarded</span>
              )}
            </span>
          }
        />
        {/* Two tiles, not four. "Terms completed" restated the header chip and
            the row count below it; "Delegations served" was the weakest figure
            on the page. Both survivors say something the table does not.
            (Also deliberately no "terms unrewarded" tile: across 200 sampled
            mainnet terms from 2020 to 2026 the Data API has never returned a
            completed term with a zero reward, so it would read 0 forever. The
            count is in the header, on the only occasion it means anything.) */}
        <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x dark:divide-zinc-800">
          <Tile
            label="Validating since"
            value={totals.firstStart ? dayShort(totals.firstStart) + ", " + new Date(totals.firstStart * 1000).getUTCFullYear() : "—"}
            sub={
              totals.firstStart
                ? `${formatNumber(Math.floor((Date.now() / 1000 - totals.firstStart) / 86400))} days on record`
                : undefined
            }
          />
          <Tile
            label="Rewards earned"
            value={avax(lifetimeReward.toString())}
            strong
            tone="good"
            sub="own stake plus fee take, across every term"
          />
        </div>
        <div className="sticky top-0 z-10 hidden grid-cols-[1.5fr_0.6fr_1fr_0.8fr_1fr] gap-4 border-t border-zinc-200 bg-white px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
          <span>Term</span>
          <span className="text-right">Days</span>
          <span className="text-right">Stake</span>
          <span className="text-right">Delegators</span>
          <span className="text-right">Reward paid</span>
        </div>
        <div className="divide-y divide-zinc-200 border-t border-zinc-200 md:border-t-0 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((p) => {
            const days = Math.round((p.endTimestamp - p.startTimestamp) / 86400);
            const paid = BigInt(p.validationReward) + BigInt(p.delegationReward);
            return (
              <div
                key={p.txHash}
                className={cn(ROW, "md:grid-cols-[1.5fr_0.6fr_1fr_0.8fr_1fr]")}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-[11.5px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    {dayShort(p.startTimestamp)} → {dayLong(p.endTimestamp).replace(/^\w+, /, "")}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    ended {timeAgo(p.endTimestamp)}
                  </span>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Days</CellLabel>
                  {formatNumber(days)}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-100">
                  <CellLabel>Stake</CellLabel>
                  {avax(p.amountStaked)}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Delegators</CellLabel>
                  {formatNumber(p.delegatorCount)}
                </div>
                <div className="font-mono text-[11px] tabular-nums md:text-right">
                  <CellLabel>Reward paid</CellLabel>
                  {p.rewarded ? (
                    // the reward tx is the receipt; pre-Banff payouts have none
                    p.rewardTxHash ? (
                      <Link
                        href={`${base}/tx/${p.rewardTxHash}`}
                        className="text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        +{avax(paid.toString())}
                      </Link>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{avax(paid.toString())}
                      </span>
                    )
                  ) : (
                    <span className="text-[#E6212F]">no reward</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {periods.length > LIST_CAP && (
          <ExpandRow
            expanded={showAll}
            count={periods.length - LIST_CAP}
            onClick={() => setShowAll((v) => !v)}
          />
        )}
      </Board>
    </section>
  );
}

/* The L1 validator's live record, straight from the P-Chain. Slimmer than
   the indexer view (no uptime history or delegators: L1 validators have
   neither on the Primary Network), but authoritative. */
function L1ValidatorView({
  nodeId,
  subnetId,
  v,
  live = true,
  base,
}: {
  nodeId: string;
  subnetId: string;
  v: CurrentValidator;
  /** false when the record came from the indexer snapshot instead of the node */
  live?: boolean;
  base: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Node"
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {live ? "L1 validator · live from P-Chain" : "L1 validator · indexer snapshot"}
            </span>
          }
        />
        <SubjectHeadline value={nodeId} copyLabel="Copy NodeID" />
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader label="L1 Validation" />
          <Board divide={false} className="px-5 py-4 md:px-6">
            <SpecPlate>
              <SpecRow label="Subnet">
                <HashChip value={subnetId} href={`${base}/tx/${subnetId}`} len={24} />
              </SpecRow>
              {v.validationID && (
                <SpecRow label="Validation ID">
                  <HashChip value={v.validationID} len={24} />
                </SpecRow>
              )}
              <SpecRow label="Weight">{formatNumber(Number(v.weight))}</SpecRow>
              {v.balance !== undefined && <SpecRow label="Balance">{formatAvax(v.balance)}</SpecRow>}
              {v.startTime && <SpecRow label="Start">{formatTime(Number(v.startTime))}</SpecRow>}
              {v.publicKey && (
                <SpecRow label="BLS Public Key">
                  <HashChip value={v.publicKey} len={24} />
                </SpecRow>
              )}
            </SpecPlate>
          </Board>
        </section>

        {(v.remainingBalanceOwner || v.deactivationOwner) && (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Owners" />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                {v.remainingBalanceOwner?.addresses?.map((a) => (
                  <SpecRow key={a} label="Remaining Balance">
                    <HashChip value={a} len={24} />
                  </SpecRow>
                ))}
                {v.deactivationOwner?.addresses?.map((a) => (
                  <SpecRow key={a} label="Deactivation">
                    <HashChip value={a} len={24} />
                  </SpecRow>
                ))}
              </SpecPlate>
            </Board>
          </section>
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  strong = false,
  tone,
  sub,
}: {
  label: string;
  value: string;
  /** the figures eyes should land on first */
  strong?: boolean;
  tone?: "good" | "warn" | "bad";
  /** muted qualifier under the figure: a share, a cap, a count */
  sub?: string;
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-[#E6212F]"
          : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`font-mono tabular-nums tracking-tight ${toneCls} ${
          strong ? "text-xl font-bold md:text-2xl" : "text-lg md:text-xl"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px] tabular-nums tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
          {sub}
        </span>
      )}
    </div>
  );
}

/* the escape hatch that keeps long lists from becoming the page */
function ExpandRow({ expanded, count, onClick }: { expanded: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-5 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    >
      {expanded ? "Show less" : `Show ${count} more`}
    </button>
  );
}
