"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
} from "recharts";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  BoardHeader,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  SubjectHeadline,
  TxTypePill,
  idInk,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import {
  PRIMARY_SUBNET_ID,
  getCurrentValidators,
  getPrimaryTotalStake,
  type CurrentValidator,
} from "@/lib/pchain-node";
import type { NodeResponse } from "@/lib/pchain-explorer";

/* The node page as one instrument, not an endless scroll: a bold summary
   strip, then two split views — what the validator IS (the spec plate)
   beside how it's PERFORMING (the hourly charts folded in from the old
   /stats/validators/node page) — and the long lists capped behind
   expanders. */

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

/* the money context the indexer doesn't mirror: the live validator entry
   (payout owners, BLS identity) and the network's total stake — the
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

export function PchainNode({
  chain,
  network,
  nodeId,
  subnetHint,
}: {
  chain: string;
  network: string;
  nodeId: string;
  /** subnet the caller knows this node validates — lets us ask the P-Chain
   *  directly when the indexer (Primary Network only) has never seen it */
  subnetHint?: string;
}) {
  const base = `/explorer/${network}/${chain}`;
  const { data: n, loading, error } = usePchainData<NodeResponse>(network, `node/${nodeId}`);
  // the P2P observatory only watches mainnet's Primary Network
  const p2p = useP2PDetail(nodeId, network === "mainnet" && Boolean(n?.hasSnapshot));
  // payout owners + BLS identity + the network-share denominator, live
  const { identity, networkStake } = useStakeContext(network, nodeId, Boolean(n?.hasSnapshot));

  // the stake story, derived once: share of the network, delegation
  // headroom, the validator's total take, how far through the term it is
  const stake = useMemo(() => {
    const v = n?.validator;
    if (!v) return null;
    const maxTotal = Math.min(5 * v.weight, MAX_TOTAL_STAKE_NAVAX);
    const capacity = Math.max(0, maxTotal - v.totalStake);
    const sharePct = networkStake ? (v.totalStake / networkStake) * 100 : null;
    const feeTake = n.delegatorsPotentialReward * (v.delegationFeePercent / 100);
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

  // L1-only validators never stake on the Primary Network, so the indexer
  // 404s on them. With a subnet hint we go straight to the node:
  // platform.getCurrentValidators({subnetID, nodeIDs}).
  const [l1, setL1] = useState<CurrentValidator | null>(null);
  const [l1Checked, setL1Checked] = useState(false);
  useEffect(() => {
    if (!error || !subnetHint) return;
    let cancelled = false;
    getCurrentValidators(network, subnetHint, [nodeId]).then((vs) => {
      if (cancelled) return;
      setL1(vs?.[0] ?? null);
      setL1Checked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [error, subnetHint, network, nodeId]);

  const [showAllDelegators, setShowAllDelegators] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

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
      {error && subnetHint && !l1Checked && <DetailSkeleton label="Validator" />}
      {error && (!subnetHint || (l1Checked && !l1)) && <NotFound label="Node not found" id={nodeId} />}
      {error && l1 && <L1ValidatorView nodeId={nodeId} subnetId={subnetHint!} v={l1} base={base} />}
      {n && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Node"
              action={
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                    n.validator.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      n.validator.connected ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                    }`}
                  />
                  {n.validator.connected ? "Connected" : "Offline"}
                </span>
              }
            />
            <SubjectHeadline value={n.nodeId} copyLabel="Copy NodeID" />
            {!n.hasSnapshot && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Not in the latest validator snapshot. Showing on-chain history.
              </p>
            )}
          </section>

          {/* the numbers that matter, bold, in one strip: the stake story
              on the first row, the operational story on the second */}
          {n.hasSnapshot && (
            <Board divide={false} className="border">
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 dark:divide-zinc-800">
                <Tile
                  label="Total stake"
                  value={formatAvax(n.validator.totalStake, { compact: true })}
                  strong
                  sub={stake?.sharePct != null ? `${stake.sharePct.toFixed(2)}% of the network` : undefined}
                />
                <Tile label="Own stake" value={formatAvax(n.validator.weight, { compact: true })} />
                <Tile
                  label="Delegated"
                  value={formatAvax(n.validator.delegatorWeight, { compact: true })}
                  sub={`${formatNumber(n.validator.delegatorCount)} delegators`}
                />
                <Tile
                  label="Open capacity"
                  value={stake ? formatAvax(stake.capacity, { compact: true }) : "—"}
                  tone={stake && stake.capacity === 0 ? "bad" : undefined}
                  sub={
                    stake
                      ? stake.capacity === 0
                        ? "full — no room to delegate"
                        : `of ${formatAvax(stake.maxTotal, { compact: true })} max`
                      : undefined
                  }
                />
                <Tile
                  label="Uptime"
                  value={`${n.uptime.currentP50.toFixed(1)}%`}
                  strong
                  tone={n.uptime.currentP50 >= 98 ? "good" : n.uptime.currentP50 >= 90 ? "warn" : "bad"}
                />
                {/* miss_rate_14d arrives as a percent already (0–100) */}
                <Tile
                  label="Miss rate · 14d"
                  value={p2p ? `${p2p.miss_rate_14d.toFixed(1)}%` : "—"}
                  tone={p2p ? (p2p.miss_rate_14d === 0 ? "good" : p2p.miss_rate_14d < 5 ? "warn" : "bad") : undefined}
                />
                <Tile label="Proposed · 14d" value={formatNumber(p2p?.proposed_14d ?? n.proposedBlocks14d)} />
                <Tile
                  label="Days left"
                  value={formatNumber(n.validator.daysLeft)}
                  sub={stake?.progressPct != null ? `${stake.progressPct.toFixed(0)}% of term elapsed` : undefined}
                />
              </div>
            </Board>
          )}

          {/* what validating pays: the validator's own reward, its cut of
              the delegators' rewards, and the split between the two — the
              money story the roster page can't carry per-node */}
          {n.hasSnapshot && stake && (
            <section className="flex flex-col gap-3">
              <Board divide={false} className="border">
                <BoardHeader
                  label="Potential Rewards"
                  display
                  action={
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      at term end · if uptime holds
                    </span>
                  }
                />
                <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
                  <Tile
                    label="Own stake reward"
                    value={formatAvax(n.validator.potentialReward, { compact: true })}
                  />
                  <Tile
                    label="Delegation fee take"
                    value={formatAvax(stake.feeTake, { compact: true })}
                    sub={`${n.validator.delegationFeePercent}% of ${formatAvax(n.delegatorsPotentialReward, { compact: true })} gross`}
                  />
                  <Tile
                    label="Validator total"
                    value={formatAvax(stake.totalTake, { compact: true })}
                    strong
                    tone="good"
                  />
                  <Tile
                    label="Delegators net"
                    value={formatAvax(Math.max(0, n.delegatorsPotentialReward - stake.feeTake), {
                      compact: true,
                    })}
                    sub="gross minus the fee"
                  />
                </div>
                {/* where the validator's take comes from, as one bar */}
                {stake.totalTake > 0 && (
                  <div className="flex flex-col gap-2 border-t border-zinc-200 px-5 py-4 md:px-6 dark:border-zinc-800">
                    <div className="flex h-2 w-full overflow-hidden">
                      <div
                        className="bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${(n.validator.potentialReward / stake.totalTake) * 100}%` }}
                      />
                      <div className="flex-1 bg-[#E6212F]" />
                    </div>
                    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      <span>
                        ■ own stake{" "}
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {((n.validator.potentialReward / stake.totalTake) * 100).toFixed(1)}%
                        </span>
                      </span>
                      <span>
                        delegation fees{" "}
                        <span className="font-bold text-[#E6212F]">
                          {((stake.feeTake / stake.totalTake) * 100).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </Board>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Projected payouts at the end of the term, assuming the validator keeps meeting the
                uptime requirement. Delegator rewards are shown gross; the fee comes out at payout.
              </p>
            </section>
          )}

          {/* split view: what it IS | how it's PERFORMING */}
          {n.hasSnapshot && (
            <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[1fr_1.1fr]">
              <section className="flex flex-col gap-4">
                <SectionHeader label="Validation" />
                <Board divide={false} className="px-5 py-4 md:px-6">
                  <SpecPlate>
                    <SpecRow label="Subnet">
                      <HashChip value={n.validator.subnetId} len={24} />
                    </SpecRow>
                    {n.validator.validationId && (
                      <SpecRow label="Validation ID">
                        <HashChip value={n.validator.validationId} len={24} />
                      </SpecRow>
                    )}
                    {n.validator.txId && (
                      <SpecRow label="Staking tx">
                        <HashChip value={n.validator.txId} href={`${base}/tx/${n.validator.txId}`} len={24} />
                      </SpecRow>
                    )}
                    <SpecRow label="Delegation fee">{n.validator.delegationFeePercent}%</SpecRow>
                    {/* where the money lands — live from the P-Chain, since
                        the indexer doesn't mirror reward owners */}
                    {validationPayout?.addresses?.[0] && (
                      <SpecRow label="Payout · validation">
                        <HashChip
                          value={validationPayout.addresses[0]}
                          href={`${base}/address/${validationPayout.addresses[0]}`}
                          len={22}
                        />
                      </SpecRow>
                    )}
                    {delegationPayout?.addresses?.[0] &&
                      delegationPayout.addresses[0] !== validationPayout?.addresses?.[0] && (
                        <SpecRow label="Payout · delegation">
                          <HashChip
                            value={delegationPayout.addresses[0]}
                            href={`${base}/address/${delegationPayout.addresses[0]}`}
                            len={22}
                          />
                        </SpecRow>
                      )}
                    {identity?.signer?.publicKey && (
                      <SpecRow label="BLS public key">
                        <HashChip value={identity.signer.publicKey} len={22} />
                      </SpecRow>
                    )}
                    {n.nodeInfo?.version && <SpecRow label="Version">{n.nodeInfo.version}</SpecRow>}
                    {n.nodeInfo?.publicIp && (
                      <SpecRow label="Public IP">
                        <span className="font-mono text-[12px]">{n.nodeInfo.publicIp}</span>
                      </SpecRow>
                    )}
                  </SpecPlate>
                  {/* the term as a bar: dates at the ends, progress in between */}
                  <div className="flex flex-col gap-1.5 border-t border-zinc-200 py-3.5 dark:border-zinc-800">
                    <div className="flex h-1.5 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className="bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${(stake?.progressPct ?? 0).toFixed(1)}%` }}
                      />
                    </div>
                    <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      <span>{formatTime(n.validator.startTimestamp)}</span>
                      {stake?.progressPct != null && (
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {stake.progressPct.toFixed(1)}% · {formatNumber(n.validator.daysLeft)}d left
                        </span>
                      )}
                      <span>{formatTime(n.validator.endTimestamp)}</span>
                    </div>
                  </div>
                </Board>
              </section>

              <section className="flex flex-col gap-4">
                <SectionHeader
                  label="Performance"
                  action={
                    uptimeSeries.length > 1 ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        {p2p?.uptime?.length ? "hourly · 14d" : "snapshots"}
                      </span>
                    ) : undefined
                  }
                />
                <Board divide={false} className="flex flex-col gap-5 px-5 py-5 md:px-6">
                  {/* uptime, hourly */}
                  {uptimeSeries.length > 1 ? (
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={uptimeSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                          <YAxis hide domain={["dataMin", 100]} />
                          <RechartsTooltip
                            cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload as { t: string; v: number };
                              return (
                                <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                                  <p className="text-[10px] text-zinc-500">{d.t}</p>
                                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {d.v.toFixed(2)}% uptime
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Area
                            dataKey="v"
                            type="monotone"
                            stroke="#E6212F"
                            strokeWidth={1.5}
                            fill="#E6212F"
                            fillOpacity={0.08}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Not enough samples</p>
                  )}
                  {n.uptime.sampleCount > 0 && (
                    <div className="grid grid-cols-5 gap-4">
                      {[
                        { l: "MIN", v: n.uptime.min },
                        { l: "AVG", v: n.uptime.avg },
                        { l: "P50", v: n.uptime.p50 },
                        { l: "P95", v: n.uptime.p95 },
                        { l: "MAX", v: n.uptime.max },
                      ].map((s) => (
                        <div key={s.l} className="flex flex-col gap-1">
                          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                            {s.l}
                          </span>
                          <span className="font-mono text-[13px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {s.v.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* block production, proposed vs missed */}
                  {blocksSeries.length > 1 && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          Block production
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          <span className="text-zinc-900 dark:text-zinc-100">{formatNumber(p2p?.proposed_14d ?? 0)}</span>{" "}
                          proposed ·{" "}
                          <span className={p2p && p2p.missed_14d > 0 ? "text-[#E6212F]" : ""}>
                            {formatNumber(p2p?.missed_14d ?? 0)} missed
                          </span>
                        </span>
                      </div>
                      <div className="h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={blocksSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                            <YAxis hide domain={[0, "dataMax"]} />
                            <RechartsTooltip
                              cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                const d = payload[0].payload as { t: string; proposed: number; missed: number };
                                return (
                                  <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                                    <p className="text-[10px] text-zinc-500">{d.t}</p>
                                    <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                      {d.proposed} proposed
                                    </p>
                                    {d.missed > 0 && (
                                      <p className="text-xs tabular-nums text-[#E6212F]">{d.missed} missed</p>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Line dataKey="proposed" type="monotone" stroke="#A2AFB2" strokeWidth={1.5} dot={false} />
                            <Line dataKey="missed" type="monotone" stroke="#E6212F" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* proposal timing: how often it lands its first slot */}
                  {slots && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          Proposal timing
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          slot 0 <span className="font-bold text-zinc-900 dark:text-zinc-100">{((slots.slot0 / slots.total) * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden">
                        <div
                          className="bg-zinc-900 dark:bg-zinc-100"
                          style={{ width: `${(slots.slot0 / slots.total) * 100}%` }}
                          title={`Slot 0 · ${formatNumber(slots.slot0)}`}
                        />
                        <div
                          className="bg-[#A2AFB2]"
                          style={{ width: `${(slots.slot1 / slots.total) * 100}%` }}
                          title={`Slot 1 · ${formatNumber(slots.slot1)}`}
                        />
                        <div
                          className="bg-[#E6212F]"
                          style={{ width: `${(slots.slot2plus / slots.total) * 100}%` }}
                          title={`Slot 2+ · ${formatNumber(slots.slot2plus)}`}
                        />
                      </div>
                      <div className="flex gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        <span>■ slot 0 first try</span>
                        <span>slot 1</span>
                        <span className="text-[#E6212F]">slot 2+</span>
                      </div>
                    </div>
                  )}
                </Board>
              </section>
            </div>
          )}

          {/* one validation is already the plate's Subnet row — this strip
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

          {/* split view: money | record — two symmetric lists, same cap,
              same rhythm, so the rails end together */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            {n.delegators.length > 0 && (
              <section className="flex min-w-0 flex-col gap-4">
                <SectionHeader
                  label={`Delegators · ${n.delegators.length}`}
                  action={
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      Σ reward{" "}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatAvax(n.delegatorsPotentialReward, { compact: true })}
                      </span>
                    </span>
                  }
                />
                <Board>
                  {(showAllDelegators ? n.delegators : n.delegators.slice(0, LIST_CAP)).map((d) => (
                    <Link
                      key={d.txId}
                      href={`${base}/tx/${d.txId}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                    >
                      <span className={`font-mono text-[12px] ${idInk}`}>{truncate(d.txId, 16)}</span>
                      <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {formatAvax(d.stakeAmount, { compact: true })}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{formatAvax(d.potentialReward, { compact: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
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
                <SectionHeader label={`History · ${n.history.length}`} />
                <Board>
                  {(showAllHistory ? n.history : n.history.slice(0, LIST_CAP)).map((h) => (
                    <Link
                      key={h.txHash}
                      href={`${base}/tx/${h.txHash}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`truncate font-mono text-[12px] ${idInk}`}>
                          {truncate(h.txHash, 16)}
                        </span>
                        <TxTypePill type={h.txType.replace(/Tx$/, "")} />
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        {timeAgo(h.blockTimestamp)}
                      </span>
                    </Link>
                  ))}
                  {n.history.length > LIST_CAP && (
                    <ExpandRow
                      expanded={showAllHistory}
                      count={n.history.length - LIST_CAP}
                      onClick={() => setShowAllHistory((v) => !v)}
                    />
                  )}
                </Board>
              </section>
            )}
          </div>
        </div>
      )}
    </ExplorerShell>
  );
}

/* The L1 validator's live record, straight from the P-Chain. Slimmer than
   the indexer view (no uptime history or delegators — L1 validators have
   neither on the Primary Network), but authoritative. */
function L1ValidatorView({
  nodeId,
  subnetId,
  v,
  base,
}: {
  nodeId: string;
  subnetId: string;
  v: CurrentValidator;
  base: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Node"
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              L1 validator · live from P-Chain
            </span>
          }
        />
        <SubjectHeadline value={nodeId} copyLabel="Copy NodeID" />
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-2">
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
  /** muted qualifier under the figure — a share, a cap, a count */
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
